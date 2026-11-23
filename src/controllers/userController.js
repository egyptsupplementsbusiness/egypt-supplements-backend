import User from "../models/userModel.js";
import PasswordReset from "../models/passwordResetModel.js";
import generateToken from "../utils/generateToken.js";

// ---------------------------- User Register ----------------------------
export const registerUser = async (req, res) => {
  const { name, password, phone } = req.body;
  const email = req.body.email?.trim().toLowerCase();

  if (!name || !email || !password || !phone) {
    res.status(400);
    throw new Error("Please fill in all fields");
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error("User already exists");
  }

  const user = await User.create({ name, email, password, phone });

  if (user) {
    res.status(201).json({
      message: "User registered successfully!",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      token: generateToken(user._id),
    });
  } else {
    res.status(400);
    throw new Error("Invalid user data received");
  }
};

// ---------------------------- User Login ----------------------------
export const loginUser = async (req, res) => {
  const { password } = req.body;
  const email = req.body.email?.trim().toLowerCase();

  if (!email || !password) {
    res.status(400);
    throw new Error("Please provide both an email and a password");
  }

  const user = await User.findOne({ email }).select("+password");

  // Check if the user exists AND the password is correct
  if (user && (await user.matchPassword(password))) {
    // --- NEW: Check if the account is suspended/deactivated ---
    if (!user.isActive) {
      res.status(403);
      throw new Error(
        user.deactivatedBy === "self"
          ? "This account was closed. Contact the shop on WhatsApp if you'd like it back."
          : "This account has been deactivated. Please contact support.",
      );
    }

    // If active, proceed with login
    res.status(200).json({
      message: "User logged in successfully!",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      token: generateToken(user._id),
    });
  } else {
    res.status(401);
    throw new Error("Invalid email or password");
  }
};

// ---------------------------- User Profile ----------------------------
export const getUserProfile = async (req, res) => {
  // protect() already loaded the user, no need to query again
  const user = req.user;

  if (user) {
    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      address: user.address || "",
      savedAddress: user.savedAddress || {},
    });
  } else {
    res.status(404);
    throw new Error("User not found");
  }
};

// ---------------------------- Update User Profile ----------------------------
export const updateUserProfile = async (req, res) => {
  if (req.body.role || req.body.email || req.body.password) {
    res.status(403); // 403 Forbidden
    throw new Error(
      "You are not authorized to update email, password, or role from this endpoint.",
    );
  }

  const user = await User.findById(req.user._id);

  if (user) {
    // Update basic info
    user.name = req.body.name || user.name;
    user.phone = req.body.phone || user.phone;

    if (req.body.address !== undefined) {
      user.address = req.body.address;
    }

    if (req.body.savedAddress !== undefined) {
      const a = req.body.savedAddress || {};
      user.savedAddress = {
        governorate: a.governorate ?? user.savedAddress?.governorate ?? "",
        city: a.city ?? user.savedAddress?.city ?? "",
        street: a.street ?? user.savedAddress?.street ?? "",
        building: a.building ?? user.savedAddress?.building ?? "",
        notes: a.notes ?? user.savedAddress?.notes ?? "",
      };
    }

    const updatedUser = await user.save();

    res.status(200).json({
      message: "Profile updated successfully!",
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        address: updatedUser.address,
        savedAddress: updatedUser.savedAddress,
        role: updatedUser.role,
      },
    });
  } else {
    res.status(404);
    throw new Error("User not found");
  }
};

// ---------------------------- Update Password (User/Admin Self-Service) ----------------------------
export const updateUserPassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    res.status(400);
    throw new Error("Please provide both old and new passwords");
  }
  const user = await User.findById(req.user._id).select("+password");

  if (user && (await user.matchPassword(oldPassword))) {
    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: "Password updated successfully" });
  } else {
    res.status(401);
    throw new Error("Incorrect old password");
  }
};

// ---------------------------- Change Email (Self-Service, needs password) ----------------------------
export const updateUserEmail = async (req, res) => {
  const { password } = req.body;
  const email = req.body.email?.trim().toLowerCase();

  const user = await User.findById(req.user._id).select("+password");
  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error("That password is incorrect");
  }

  if (email === user.email) {
    res.status(400);
    throw new Error("That is already your email address");
  }

  if (await User.exists({ email, _id: { $ne: user._id } })) {
    res.status(400);
    throw new Error("That email is already in use by another account");
  }

  user.email = email;
  await user.save();

  res.status(200).json({
    message: "Email updated",
    user: { _id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role },
  });
};

// ---------------------------- Close My Account (Self-Service, needs password) ----------------------------
// A soft delete: the account is switched off (so it can be restored and so past
// orders stay intact), not erased.
export const deactivateMyAccount = async (req, res) => {
  const { password } = req.body;

  const user = await User.findById(req.user._id).select("+password");
  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error("That password is incorrect");
  }

  if (user.role === "admin") {
    res.status(400);
    throw new Error("Admin accounts can't be closed from here.");
  }

  user.isActive = false;
  user.deactivatedBy = "self";
  await user.save();

  res.status(200).json({ message: "Your account has been closed." });
};

// ---------------------------- Forgot Password (Public) ----------------------------
// We don't send emails. We log a request an admin can act on, and always reply
// the same way so the form can't be used to guess which emails have accounts.
export const forgotPassword = async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();
  const user = email ? await User.findOne({ email }) : null;

  if (user && user.isActive) {
    // Avoid piling up duplicates: reuse a still-open request for this account
    const open = await PasswordReset.findOne({ user: user._id, status: "pending" });
    if (!open) {
      await PasswordReset.create({
        user: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      });
    }
  }

  res.status(200).json({
    message: "If there's an account for that email, the shop has been notified and will contact you to reset it.",
  });
};

// ---------------------------- Password Reset Requests (Admin) ----------------------------
export const getResetRequests = async (req, res) => {
  const status = req.query.status === "all" ? {} : { status: "pending" };
  const requests = await PasswordReset.find(status).sort({ createdAt: -1 }).limit(100);
  const pendingCount = await PasswordReset.countDocuments({ status: "pending" });
  res.status(200).json({ requests, pendingCount });
};

export const resolveResetRequest = async (req, res) => {
  const request = await PasswordReset.findByIdAndUpdate(
    req.params.id,
    { $set: { status: "resolved", resolvedAt: new Date(), resolvedBy: req.user._id } },
    { returnDocument: "after" },
  );
  if (!request) {
    res.status(404);
    throw new Error("Request not found");
  }
  res.status(200).json({ message: "Marked as done", request });
};

// ---------------------------- Set a User's Password (Admin) ----------------------------
// For helping a customer who forgot theirs. Signs out their old sessions and
// closes any open reset request for them.
export const adminSetUserPassword = async (req, res) => {
  const { newPassword } = req.body;
  const user = await User.findById(req.params.id).select("+password");
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  user.password = newPassword; // the model re-stamps passwordChangedAt on save
  await user.save();

  await PasswordReset.updateMany(
    { user: user._id, status: "pending" },
    { $set: { status: "resolved", resolvedAt: new Date(), resolvedBy: req.user._id } },
  );

  res.status(200).json({ message: "New password set for this customer." });
};

// ---------------------------- Get All Users (Admin) ----------------------------
export const getUsers = async (req, res) => {
  const pageSize = Number(req.query.limit) || 10;
  const page = Number(req.query.page) || 1;

  let keywordFilter = {};

  if (req.query.keyword) {
    // 1. Remove accidental spaces the admin might type at the end
    const rawKeyword = req.query.keyword.trim();

    // 2. Escape special characters (like + or -) so regex doesn't break
    const safeKeyword = rawKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    keywordFilter = {
      $or: [
        { name: { $regex: safeKeyword, $options: "i" } },
        { email: { $regex: safeKeyword, $options: "i" } },
        { phone: { $regex: safeKeyword, $options: "i" } },
      ],
    };
  }

  // 3. Apply the filter to the count
  const count = await User.countDocuments({ ...keywordFilter });

  // 4. Apply the filter to the database query
  const users = await User.find({ ...keywordFilter })
    .select("-password -__v")
    .sort({ createdAt: -1 }) // stable order so pages don't shuffle
    .limit(pageSize)
    .skip(pageSize * (page - 1));

  res.status(200).json({
    users,
    page,
    pages: Math.ceil(count / pageSize),
    totalUsers: count,
  });
};

// ---------------------------- Delete User (Admin) ----------------------------
export const deleteUser = async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
    if (user._id.toString() === req.user._id.toString()) {
      res.status(400);
      throw new Error("You cannot suspend your own admin account");
    }

    // 🔥 Change from hard delete to soft delete
    user.isActive = false;
    await user.save();

    res.status(200).json({ message: "User suspended successfully" });
  } else {
    res.status(404);
    throw new Error("User not found");
  }
};

// ---------------------------- Get User By ID (Admin) ----------------------------
export const getUserById = async (req, res) => {
  const user = await User.findById(req.params.id).select("-password -__v");

  if (user) {
    res.status(200).json(user);
  } else {
    res.status(404);
    throw new Error("User not found");
  }
};

// ---------------------------- Update User (Admin Override) ----------------------------
export const updateUser = async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
    const isSelf = user._id.toString() === req.user._id.toString();

    // Stop an admin from locking themselves out of the dashboard
    if (isSelf && req.body.role && req.body.role !== "admin") {
      res.status(400);
      throw new Error("You cannot remove your own admin role");
    }
    if (isSelf && req.body.isActive === false) {
      res.status(400);
      throw new Error("You cannot suspend your own admin account");
    }

    if (req.body.email) {
      req.body.email = req.body.email.trim().toLowerCase();
    }

    // Check if email is being changed and if it's already taken
    if (req.body.email && req.body.email !== user.email) {
      const emailExists = await User.findOne({ email: req.body.email });
      if (emailExists) {
        res.status(400);
        throw new Error("That email is already in use by another account");
      }
    }

    // Update standard string fields
    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.phone = req.body.phone || user.phone;
    user.role = req.body.role || user.role;

    // 🔥 THE FIX: Explicitly check for undefined since it's a boolean
    if (req.body.isActive !== undefined) {
      user.isActive = req.body.isActive;
    }

    const updatedUser = await user.save();

    res.status(200).json({
      message: "User updated successfully",
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
        isActive: updatedUser.isActive, // <-- Added this to return the new status
      },
    });
  } else {
    res.status(404);
    throw new Error("User not found");
  }
};

// ---------------------------- Get User Analytics (Admin Dashboard) ----------------------------
export const getUserAnalytics = async (req, res) => {
  // Calculate the timestamp for exactly 30 days ago
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Run all count queries concurrently for maximum performance
  const [totalUsers, activeUsers, suspendedUsers, newUsersThisMonth] =
    await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: false }),
      // This assumes you have { timestamps: true } enabled in your User schema
      User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    ]);

  res.status(200).json({
    totalUsers,
    activeUsers,
    suspendedUsers,
    newUsersThisMonth,
  });
};
