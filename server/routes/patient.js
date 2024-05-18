import express from "express";
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';

import { errorHandler } from "../middlewares/general.js";

import Patient from "../models/PatientModel.js"
import Doctor from "../models/DoctorModel.js";

const router = express.Router();
const stripe = new Stripe('sk_test_4eC39HqLyjWDarjtT1zdp7dc');

router.post("/payment", async (req, res) => {
    const { finalBalance, token, userId } = req.body;
    const idempotencyKey = uuidv4();

    try {
        const customer = await stripe.customers.create({
            email: token.email,
            source: token.id
        });

        const patient = await Patient.findOneAndUpdate({ userId: userId }, {
            stripeCustomerId: customer.id
        }, { new: true });

        const charge = await stripe.charges.create({
            amount: finalBalance * 100,
            currency: 'usd',
            customer: customer.id,
            receipt_email: token.email,
            description: "Payment for medical services",
            shipping: {
                name: token.card.name,
                address: {
                    line1: token.card.address_line1,
                    line2: token.card.address_line2,
                    city: token.card.address_city,
                    country: token.card.address_country,
                    postal_code: token.card.address_zip
                }
            }
        }, { idempotencyKey });

        res.status(200).json(charge);
    } catch (err) {
        console.error(`Error: ${err}`);
        errorHandler(res, 400, "Failed to process payment.");
    }
});

router.post("/applyDoctor", async (req, res) => {
    const { userId, name, specialty } = req.body;

    if (!userId || !name || !specialty) {
        return errorHandler(res, 400, "All fields are required.");
    }

    try {
        const patient = await Patient.findOne({ userId });
        if (!patient) {
            return errorHandler(res, 404, "Patient not found.");
        }

        const newDoctor = new Doctor({
            userId: patient.userId,
            name: name,
            specialty: specialty
        });

        await newDoctor.save();

        await Patient.deleteOne({ userId });

        res.status(201).json({ message: "Patient application to doctor successful.", doctor: newDoctor });
    } catch (error) {
        console.error(`Error: ${error}`);
        errorHandler(res, 500, "Failed to apply as doctor.");
    }
});


export { router as PatientRouter };
