import User from "../models/userModel.js";
import generateToken from "../utils/generateToken.js";

// ---------------------------- User Register ----------------------------
export const registerUser = async (req, res) => {
  const { name, email, password, phone } = req.body;

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
  const { email, password } = req.body;

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
        "This account has been deactivated. Please contact support.",
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
  const user = await User.findById(req.user._id);

  if (user) {
    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      address: user.address || "",
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

    const updatedUser = await user.save();

    res.status(200).json({
      message: "Profile updated successfully!",
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        address: updatedUser.address,
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
