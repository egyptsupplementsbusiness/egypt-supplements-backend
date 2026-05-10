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

  if (user && (await user.matchPassword(password))) {
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
  const users = await User.find({}).select("-password -__v");
  res.status(200).json(users);
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

// ---------------------------- Delete User (Admin) ----------------------------
export const deleteUser = async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
    if (user._id.toString() === req.user._id.toString()) {
      res.status(400);
      throw new Error("You cannot delete your own admin account");
    }

    await user.deleteOne();
    res.status(200).json({ message: "User removed successfully" });
  } else {
    res.status(404);
    throw new Error("User not found");
  }
};

// ---------------------------- Update User (Admin Override) ----------------------------
export const updateUser = async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
    if (req.body.email && req.body.email !== user.email) {
      const emailExists = await User.findOne({ email: req.body.email });
      if (emailExists) {
        res.status(400);
        throw new Error("That email is already in use by another account");
      }
    }

    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.phone = req.body.phone || user.phone;
    user.role = req.body.role || user.role;

    const updatedUser = await user.save();

    res.status(200).json({
      message: "User updated successfully",
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
      },
    });
  } else {
    res.status(404);
    throw new Error("User not found");
  }
};
