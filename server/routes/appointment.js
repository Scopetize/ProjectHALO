import express from "express";

import { errorHandler } from "../middlewares/general.js";

import Appointment from "../models/AppointmentModel.js";
import Doctor from "../models/DoctorModel.js";

const router = express.Router();

router.post('/book', async (req, res) => {
    const { doctorId, date, startTime, endTime } = req.body;

    const formattedStartTime = startTime.padStart(5, "0");
    const formattedEndTime = endTime.padStart(5, "0");

    try {
        const doctor = await Doctor.findById(doctorId);
        if (!doctor) {
            return errorHandler(res, 404, "Doctor not found");
        }

        const requestedDate = new Date(date);
        const currentDate = new Date();
        if (requestedDate < currentDate) {
            return errorHandler(res, 400, "Requested date has already passed");
        }

        const availabilityForDate = doctor.availability.find(
            availability => availability.date.toDateString() === requestedDate.toDateString()
        );

        if (!availabilityForDate) {
            return errorHandler(res, 400, "Doctor not available on this date");
        }

        const requestedSlot = availabilityForDate.slots.find(
            slot => slot.startTime === formattedStartTime && slot.endTime === formattedEndTime
        );

        if (!requestedSlot || !requestedSlot.available) {
            return errorHandler(res, 400, "Requested time slot is not available");
        }

        const appointment = new Appointment({
            patient: req.user._id,
            doctor: doctorId,
            date: requestedDate,
            startTime: formattedStartTime,
            endTime: formattedEndTime,
        });

        await appointment.save();

        requestedSlot.available = false;
        await doctor.save();

        res.status(201).json({
            message: "Appointment Booked Successfully",
            appointment,
        });
    } catch (error) {
        errorHandler(res, 500, error.message);
    }
});

router.get('/patient', async (req, res) => {
    const patientId = req.user._id;

    try {
        const appointments = await Appointment.find({ patient: patientId })
            .populate("doctor", "name specialty -_id");

        res.status(200).json(appointments);
    } catch (error) {
        errorHandler(res, 500, error.message);
    }
});

router.get('/doctor', async (req, res) => {
    const doctorId = req.user._id;

    try {
        const appointments = await Appointment.find({ doctor: doctorId })
            .populate("patient", "name contact -_id");

        res.status(200).json(appointments);
    } catch (error) {
        errorHandler(res, 500, error.message);
    }
});

export { router as AppointmentRouter };
