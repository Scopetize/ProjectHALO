import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  verified: { type: Boolean, default: false },
}, { timestamps: true });

const UserModel = mongoose.model("User", UserSchema);

export { UserModel as User };
