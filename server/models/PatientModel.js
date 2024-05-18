import mongoose from "mongoose";

const PatientSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  username: { type: String, required: true },
  stripeCustomerId: { type: String },
}, { timestamps: true });

PatientSchema.pre('save', function(next) {
  if (!this.isModified('role')) {
    this.role = 'Patient';
  }
  next();
});

PatientSchema.post('save', async function() {
  try {
    if (this.isNew) {
      await this.constructor.collection.createIndex({ username: 'text' });
    }
  } catch (error) {
    console.error('Error creating text index on Patient collection:', error);
  }
});

const Patient = mongoose.model("Patient", PatientSchema);

export default Patient;
