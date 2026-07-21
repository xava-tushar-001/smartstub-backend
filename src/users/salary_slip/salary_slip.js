const helper = require('../../../helper/helper');
const db = require("../../../models");
const { Op } = require('sequelize');
const SalarySlip = db.salary_slip;
const { analyzeSalarySlip } = require('../../../helper/gemini');
const { getPlanLimit, getMonthlyUploadCount } = require('../../../helper/plan');

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function serializeSlip(slip) {
    const json = slip.toJSON();
    delete json.file_data;
    return json;
}

module.exports = function () {
    let module = {};

    /**
     * Upload a salary slip and analyze it with Claude.
     * multipart/form-data, field name: slip
     */
    module.Upload = async (req, res) => {
        try {
            const file = req.files?.slip;

            if (!file) {
                return helper.error(res, "Please attach a salary slip file (PDF, JPG, PNG, or WEBP)");
            }
            if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
                return helper.error(res, "Unsupported file type. Please upload a PDF, JPG, PNG, or WEBP file");
            }
            if (file.size > MAX_FILE_SIZE) {
                return helper.error(res, "File is too large. Maximum size is 10MB");
            }

            const plan = req.user.plan || 'free';
            const limit = getPlanLimit(plan);
            const usedThisMonth = await getMonthlyUploadCount(req.user.id);

            if (usedThisMonth >= limit) {
                return helper.error(
                    res,
                    plan === 'free'
                        ? `You've used all ${limit} free payslip uploads this month. Upgrade to Pro for up to 12/month.`
                        : `You've reached your Pro plan limit of ${limit} payslip uploads this month.`,
                    { limit_reached: true, plan, limit, used: usedThisMonth }
                );
            }

            const slip = await SalarySlip.create({
                user_id: req.user.id,
                file_name: file.name,
                mime_type: file.mimetype,
                file_size: file.size,
                file_data: file.data,
                status: 'processing',
            });

            try {
                const { summary, checks } = await analyzeSalarySlip(file.data, file.mimetype);

                const pass_count = checks.filter((c) => c.status === 'pass').length;
                const warning_count = checks.filter((c) => c.status === 'warning').length;
                const error_count = checks.filter((c) => c.status === 'error').length;
                const overall_status = error_count > 0 ? 'red' : warning_count > 0 ? 'orange' : 'green';

                await slip.update({
                    status: 'completed',
                    summary,
                    checks,
                    pass_count,
                    warning_count,
                    error_count,
                    overall_status,
                });
            } catch (analysisError) {
                console.error('Salary slip analysis failed:', analysisError);
                await slip.update({
                    status: 'failed',
                    error_message: analysisError.message || 'Analysis failed',
                });
            }

            return helper.success(res, "Salary slip uploaded", { salary_slip: serializeSlip(slip) });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    /**
     * Paginated upload history for the current user.
     * GET ?page=&search=
     */
    module.List = async (req, res) => {
        try {
            const page = parseInt(req.query.page, 10) || 1;
            const limit = 10;
            const offset = (page - 1) * limit;

            const { rows, count } = await SalarySlip.findAndCountAll({
                where: { user_id: req.user.id },
                attributes: { exclude: ['file_data'] },
                order: [['createdAt', 'DESC']],
                limit,
                offset,
            });

            return helper.success(res, "Salary slips", {
                salary_slips: rows,
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit) || 1,
                },
            });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    /**
     * Aggregate stats for the home dashboard: totals across all checks,
     * and a monthly upload count for the last 6 months (owner only).
     */
    module.GetStats = async (req, res) => {
        try {
            const userId = req.user.id;

            const totalsRow = await SalarySlip.findOne({
                where: { user_id: userId },
                attributes: [
                    [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'total'],
                    [db.sequelize.fn('SUM', db.sequelize.col('pass_count')), 'pass_total'],
                    [db.sequelize.fn('SUM', db.sequelize.col('warning_count')), 'warning_total'],
                    [db.sequelize.fn('SUM', db.sequelize.col('error_count')), 'error_total'],
                ],
                raw: true,
            });

            const rangeStart = new Date();
            rangeStart.setMonth(rangeStart.getMonth() - 5);
            rangeStart.setDate(1);
            rangeStart.setHours(0, 0, 0, 0);

            const monthlyRows = await SalarySlip.findAll({
                where: { user_id: userId, createdAt: { [Op.gte]: rangeStart } },
                attributes: [
                    [db.sequelize.fn('DATE_FORMAT', db.sequelize.col('createdAt'), '%Y-%m'), 'month'],
                    [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count'],
                ],
                group: [db.sequelize.fn('DATE_FORMAT', db.sequelize.col('createdAt'), '%Y-%m')],
                raw: true,
            });
            const monthlyByKey = new Map(monthlyRows.map((r) => [r.month, Number(r.count)]));

            const monthly_uploads = [];
            const cursor = new Date(rangeStart);
            for (let i = 0; i < 6; i++) {
                const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
                monthly_uploads.push({
                    month: cursor.toLocaleString('en-US', { month: 'short' }),
                    count: monthlyByKey.get(key) || 0,
                });
                cursor.setMonth(cursor.getMonth() + 1);
            }

            return helper.success(res, "Salary slip stats", {
                totals: {
                    total: Number(totalsRow.total) || 0,
                    pass: Number(totalsRow.pass_total) || 0,
                    warning: Number(totalsRow.warning_total) || 0,
                    error: Number(totalsRow.error_total) || 0,
                },
                monthly_uploads,
            });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    /**
     * A single salary slip's stored analysis (owner only).
     */
    module.GetOne = async (req, res) => {
        try {
            const slip = await SalarySlip.findOne({
                where: { id: req.params.id, user_id: req.user.id },
                attributes: { exclude: ['file_data'] },
            });

            if (!slip) {
                return helper.error(res, "Salary slip not found");
            }

            return helper.success(res, "Salary slip", { salary_slip: slip });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    /**
     * Re-runs analysis for a previously failed salary slip, reusing the
     * already-stored file (owner only). No re-upload needed.
     */
    module.Retry = async (req, res) => {
        try {
            const slip = await SalarySlip.findOne({
                where: { id: req.params.id, user_id: req.user.id },
            });

            if (!slip) {
                return helper.error(res, "Salary slip not found");
            }

            if (slip.status !== 'failed') {
                return helper.error(res, "Only a failed analysis can be retried");
            }

            await slip.update({ status: 'processing', error_message: null });

            try {
                const { summary, checks } = await analyzeSalarySlip(slip.file_data, slip.mime_type);

                const pass_count = checks.filter((c) => c.status === 'pass').length;
                const warning_count = checks.filter((c) => c.status === 'warning').length;
                const error_count = checks.filter((c) => c.status === 'error').length;
                const overall_status = error_count > 0 ? 'red' : warning_count > 0 ? 'orange' : 'green';

                await slip.update({
                    status: 'completed',
                    summary,
                    checks,
                    pass_count,
                    warning_count,
                    error_count,
                    overall_status,
                });
            } catch (analysisError) {
                console.error('Salary slip retry analysis failed:', analysisError);
                await slip.update({
                    status: 'failed',
                    error_message: analysisError.message || 'Analysis failed',
                });
            }

            return helper.success(res, "Analysis retried", { salary_slip: serializeSlip(slip) });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    /**
     * Streams the original uploaded file back (owner only).
     */
    module.GetFile = async (req, res) => {
        try {
            const slip = await SalarySlip.findOne({
                where: { id: req.params.id, user_id: req.user.id },
            });

            if (!slip) {
                return helper.error(res, "Salary slip not found");
            }

            res.set('Content-Type', slip.mime_type);
            res.set('Content-Disposition', `inline; filename="${slip.file_name.replace(/[\r\n"]/g, '')}"`);
            return res.send(slip.file_data);
        } catch (error) {
            return helper.error(res, error);
        }
    };

    return module;
};
