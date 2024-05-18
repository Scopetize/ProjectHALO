import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  verified: { type: Boolean, default: false },
  role: { type: String, required: true, default: 'User' },
}, { timestamps: true });

UserSchema.pre('save', function(next) {
  if (!this.isModified('role')) {
    this.role = 'User';
  }
  next();
});

const User = mongoose.model("User", UserSchema);

export default User;
