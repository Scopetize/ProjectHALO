import mongoose from "mongoose";

const DoctorSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        name: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
        },
        password: {
            type: String,
            required: true,
        },
        specialty: {
            type: String,
            required: true,
        },
        availability: [
            {
                date: {
                    type: Date,
                    required: true,
                },
                slots: [
                    {
                        startTime: {
                            type: String,
                            required: true,
                        },
                        endTime: {
                            type: String,
                            required: true,
                        },
                        available: {
                            type: Boolean,
                            default: true,
                        }
                    },
                ],
            },
        ],
    },
    {
        timestamps: true,
    }
);

DoctorSchema.pre('save', function (next) {
    if (!this.isModified('role')) {
        this.role = 'Doctor';
    }
    next();
});

DoctorSchema.post('save', async function () {
    try {
        if (this.isNew) {
            await this.constructor.collection.createIndex({ name: 'text', specialty: 'text' });
        }
    } catch (error) {
        console.error('Error creating text index on Doctor collection:', error);
    }
});

const Doctor = mongoose.model("Doctor", DoctorSchema);

export default Doctor;

