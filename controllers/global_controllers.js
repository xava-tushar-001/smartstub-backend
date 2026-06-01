const helper = require('../config/helper')

module.exports = function () {

    let module = {}

    // Function to upload an image
    module.upload_image = async (req, res) => {
        try {
            if (!req.files || !req.files.images) {
                return helper.error(res, "No image file provided");
            }
            const images = await helper.file_upload(req.files.images);
            const response = { image: images };
            return helper.success(res, "Done", response, 400);
        } catch (error) {
            return helper.error(res, error);
        }
    }


    return module;
}