const helper = require('../../../helper/helper');
const db = require("../../../models");
const SalarySlip = db.salary_slip;
const { analyzeSalarySlip } = require('../../../helper/gemini');

const VALID_CHECK_STATUSES = ['pass', 'warning', 'error'];

function serializeSlip(slip) {
    const json = slip.toJSON();
    delete json.file_data;
    return json;
}

function recomputeCounts(checks) {
    const pass_count = checks.filter((c) => c.status === 'pass').length;
    const warning_count = checks.filter((c) => c.status === 'warning').length;
    const error_count = checks.filter((c) => c.status === 'error').length;
    const overall_status = error_count > 0 ? 'red' : warning_count > 0 ? 'orange' : 'green';
    return { pass_count, warning_count, error_count, overall_status };
}

module.exports = function () {
    let module = {};

    /**
     * A single salary slip's full stored analysis, for the admin
     * manual-correction screen (any user's slip, not owner-only).
     */
    module.GetOne = async (req, res) => {
        try {
            const slip = await SalarySlip.findOne({
                where: { id: req.params.id },
                attributes: { exclude: ['file_data'] },
            });

            if (!slip) {
                return helper.error(res, 'Salary slip not found');
            }

            return helper.success(res, 'Salary slip', { salary_slip: slip });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    /**
     * Manual-correction override: an admin hand-edits the checks / overall
     * verdict / summary for a slip - typically after a failed or
     * incomplete Gemini extraction. Recomputes pass/warning/error counts
     * and the overall_status from the edited checks rather than trusting
     * whatever the client sends for them, and always leaves the slip in
     * 'completed' status so it's usable again.
     * Body: { checks: [{name, status, message}], summary, admin_note }
     */
    module.Override = async (req, res) => {
        try {
            const slip = await SalarySlip.findOne({ where: { id: req.params.id } });
            if (!slip) {
                return helper.error(res, 'Salary slip not found');
            }

            const checks = req.body.checks;
            if (!Array.isArray(checks) || checks.length === 0) {
                return helper.error(res, 'checks must be a non-empty array');
            }
            for (const check of checks) {
                if (!check || typeof check.name !== 'string' || !check.name.trim()) {
                    return helper.error(res, 'Every check needs a name');
                }
                if (!VALID_CHECK_STATUSES.includes(check.status)) {
                    return helper.error(res, `Check status must be one of: ${VALID_CHECK_STATUSES.join(', ')}`);
                }
            }

            const normalizedChecks = checks.map((c) => ({
                name: c.name.trim(),
                status: c.status,
                message: typeof c.message === 'string' ? c.message : '',
            }));
            const { pass_count, warning_count, error_count, overall_status } = recomputeCounts(normalizedChecks);

            await slip.update({
                status: 'completed',
                checks: normalizedChecks,
                summary: typeof req.body.summary === 'string' ? req.body.summary : slip.summary,
                pass_count,
                warning_count,
                error_count,
                overall_status,
                error_message: null,
                admin_overridden: true,
                admin_reviewed_at: new Date(),
                admin_note: typeof req.body.admin_note === 'string' ? req.body.admin_note : slip.admin_note,
            });

            return helper.success(res, 'Salary slip corrected', { salary_slip: serializeSlip(slip) });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    /**
     * Admin-triggered re-run of the Gemini analysis, reusing the stored
     * file - same underlying logic as the user-facing Retry endpoint, just
     * callable by an admin against any user's slip.
     */
    module.Retry = async (req, res) => {
        try {
            const slip = await SalarySlip.findOne({ where: { id: req.params.id } });
            if (!slip) {
                return helper.error(res, 'Salary slip not found');
            }

            await slip.update({ status: 'processing', error_message: null });

            try {
                const { summary, checks } = await analyzeSalarySlip(slip.file_data, slip.mime_type);
                const { pass_count, warning_count, error_count, overall_status } = recomputeCounts(checks);

                await slip.update({
                    status: 'completed',
                    summary,
                    checks,
                    pass_count,
                    warning_count,
                    error_count,
                    overall_status,
                    admin_reviewed_at: new Date(),
                });
            } catch (analysisError) {
                console.error('Admin salary slip retry analysis failed:', analysisError);
                await slip.update({
                    status: 'failed',
                    error_message: analysisError.message || 'Analysis failed',
                });
            }

            return helper.success(res, 'Analysis retried', { salary_slip: serializeSlip(slip) });
        } catch (error) {
            return helper.error(res, error);
        }
    };

    return module;
};
