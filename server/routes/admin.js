import express from "express";

import { errorHandler, sendEmail } from "../controllers/general.js";

import User from "../models/UserModel.js";
import Patient from "../models/PatientModel.js"

const router = express.Router();

router.get('/users', async (req, res) => {
    try {
        const users = await User.find({});
        res.status(200).json(users);
    } catch (error) {
        errorHandler(res, 500, "Failed to fetch users.");
    }
});

router.get('/patients', async (req, res) => {
    try {
        const patients = await Patient.find({}).populate('userId', 'email role');
        res.status(200).json(patients);
    } catch (error) {
        errorHandler(res, 500, "Failed to fetch patients.");
    }
});


router.delete('/delete/user/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        if (user.role === 'Patient') {
            await Patient.deleteOne({ userId: id });
        }
        await User.deleteOne({ _id: id });
        res.status(200).json({ message: "User and associated role data deleted successfully." });
    } catch (error) {
        errorHandler(res, 500, "Failed to delete user.");
    }
});

export { router as AdminRouter };


