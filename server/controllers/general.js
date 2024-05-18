import nodemailer from "nodemailer";

const errorHandler = (res, statusCode, message) => {
    console.error(`Error ${statusCode}: ${message}`);
    return res.status(statusCode).json({ error: message });
};

const sendEmail = async ({ to, subject, html }) => {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.GMAIL,
            pass: process.env.GMAIL_KEY
        }
    });

    const mailOptions = {
        from: process.env.AUTH_EMAIL,
        to,
        subject,
        html
    };

    try {
        const result = await transporter.sendMail(mailOptions);
        console.log("Email sent successfully.");
        return { success: true };
    } catch (error) {
        console.error("Failed to send email:", error);
        return { success: false, error: error.message };
    }
};

export { errorHandler, sendEmail };

