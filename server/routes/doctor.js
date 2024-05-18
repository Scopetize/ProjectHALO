import express from "express";

import { errorHandler } from "../middlewares/general.js";

import Doctor from "../models/DoctorModel.js";
import Appointment from "../models/AppointmentModel.js";

const router = express.Router();

router.get("/doctors", async (req, res) => {
    try {
        const doctors = await Doctor.find().select("-password");
        res.status(200).json(doctors);
    } catch (error) {
        errorHandler(res, 500, error.message);
    }
});

router.get("/doctors/specialty/:specialty", async (req, res) => {
    try {
        const doctors = await Doctor.find({
            specialty: req.params.specialty,
        }).select("name specialty availability");
        res.status(200).json(doctors);
    } catch (error) {
        errorHandler(res, 500, error.message);
    }
});

router.post("/availability", async (req, res) => {
    const { date, slots, doctorId } = req.body;

    if (!date || !slots || !doctorId) {
        return errorHandler(res, 400, "Date, slots, and doctorId are required");
    }

    try {
        const doctor = await Doctor.findById(doctorId);

        if (!doctor) {
            return errorHandler(res, 404, "Doctor not found");
        }

        const newDate = new Date(date);
        if (isNaN(newDate.getTime())) {
            return errorHandler(res, 400, "Invalid date format");
        }

        const isValidSlots = slots.every(slot => slot.startTime && slot.endTime);
        if (!isValidSlots) {
            return errorHandler(res, 400, "All slots must have startTime and endTime");
        }

        const existingAvailability = doctor.availability.find(
            (availability) => new Date(availability.date).getTime() === newDate.getTime()
        );

        if (existingAvailability) {
            slots.forEach(newSlot => {
                const slotExists = existingAvailability.slots.some(existingSlot =>
                    isSameSlot(existingSlot, newSlot)
                );

                if (!slotExists) {
                    existingAvailability.slots.push(newSlot);
                }
            });
        } else {
            doctor.availability.push({ date: newDate, slots });
        }

        await doctor.save();

        res.status(201).json({ message: "Availability added successfully" });
    } catch (error) {
        errorHandler(res, 500, error.message);
    }
});

router.get("/availability", async (req, res) => {
    const doctorId = req.user._id;

    try {
        const doctor = await Doctor.findById(doctorId);

        if (!doctor) {
            return errorHandler(res, 404, "Doctor not found");
        }

        res.status(200).json(doctor.availability);
    } catch (error) {
        errorHandler(res, 500, error.message);
    }
});

router.get("/patients/:doctorId", async (req, res) => {
    const doctorId = req.params.doctorId;

    try {
        const doctor = await Doctor.findById(doctorId);
        if (!doctor) {
            return errorHandler(res, 404, "Doctor not found");
        }

        const appointments = await Appointment.find({ doctor: doctorId }).populate(
            "patient"
        );

        const patientSet = new Set();

        const patients = appointments.reduce((acc, appointment) => {
            const patientId = appointment.patient._id.toString();
            if (!patientSet.has(patientId)) {
                patientSet.add(patientId);
                acc.push({
                    _id: appointment.patient._id,
                    name: appointment.patient.name,
                    email: appointment.patient.email,
                    date: appointment.date,
                });
            }
            return acc;
        }, []);

        res.status(200).json(patients);
    } catch (error) {
        errorHandler(res, 500, error.message);
    }
});

router.post("/prescription-report/:appointmentId", async (req, res) => {
    const { appointmentId } = req.params;
    const { doctorId, prescription, report } = req.body;

    try {
        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) {
            return errorHandler(res, 404, "Appointment not found");
        }

        if (appointment.doctor.toString() !== doctorId) {
            return errorHandler(res, 403, "You are not authorized to set prescription and report for this appointment");
        }

        appointment.prescription = prescription;
        appointment.report = report;
        await appointment.save();

        res.status(200).json({
            message: "Prescription and report set successfully",
            appointment,
        });
    } catch (error) {
        errorHandler(res, 500, error.message);
    }
});

export { router as DoctorRouter };