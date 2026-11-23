import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a name"],
    },
    email: {
      type: String,
      required: [true, "Please add an email"],
      unique: true,
      lowercase: true,
      trim: true,
      // Simple, permissive check (any TLD length); zod does the strict check on input
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Please add a valid email"],
    },
    password: {
      type: String,
      required: [true, "Please add a password"],
      minlength: 6,
      select: false,
    },
    phone: {
      type: String,
      required: [true, "Please add a phone number"],
    },
    // Legacy single-line address (kept so old data still loads)
    address: {
      type: String,
      default: "",
    },
    // Structured saved delivery address, so checkout can pre-fill it and the
    // parts match what Egyptian couriers expect.
    savedAddress: {
      governorate: { type: String, default: "" },
      city: { type: String, default: "" },
      street: { type: String, default: "" },
      building: { type: String, default: "" },
      notes: { type: String, default: "" },
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    // ==========================================
    // Soft Delete / Ban status
    // ==========================================
    isActive: {
      type: Boolean,
      default: true,
    },
    // How the account became inactive: an admin suspended it, or the customer
    // closed it themselves. Lets the sign-in message be accurate.
    deactivatedBy: {
      type: String,
      enum: ["admin", "self", null],
      default: null,
    },
    // When the password last changed. Any token issued before this is rejected,
    // so changing the password signs out every other device at once.
    passwordChangedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  // Stamp one second in the past so it can't land after a token issued in the
  // same moment (JWT timestamps are whole seconds).
  this.passwordChangedAt = new Date(Date.now() - 1000);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);

export default User;
