import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "alihasnain.h3techs@gmail.com",
        pass: process.env.GOOGLE_APP_PASSWORD,
    },
});

export default transporter;
