const jwt = require('jsonwebtoken');
const gravatar = require('gravatar');
const path = require('path');
const fs = require('fs/promises');
const Jimp = require('jimp');
const { User } = require('../models/user.model');
const { HttpError, controllerWrap } = require('../helpers');

const { SECRET_KEY, BASE_URL } = process.env;
const avatarsDir = path.join(__dirname, '../', 'public', 'avatars');

const test = async (req, res) => {
  res.status(200).json({
    message: 'testing route',
  });
};

const register = async (req, res) => {
  const { name, email, password } = req.body;
  const user = await User.findOne({ email });
  if (user) {
    throw HttpError(409, 'Email in use');
  }
  const avatarURL = gravatar.url(email);
  const newUser = new User({ name, email, password, avatarURL });
  await newUser.hashPassword();
  await newUser.save();

  const payload = { id: newUser._id };
  const token = jwt.sign(payload, SECRET_KEY);
  await User.findByIdAndUpdate(newUser._id, { token });

  res.status(201).json({
    user: { email, name, avatarURL },
    token,
  });
};

const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    throw HttpError(401, 'Email or password is wrong');
  }
  const passwordCompare = await user.comparePassword(password);
  if (!passwordCompare) {
    throw HttpError(401, 'Email or password is wrong');
  }

  const payload = {
    id: user._id,
  };

  const token = jwt.sign(payload, SECRET_KEY, { expiresIn: '23h' });
  await User.findByIdAndUpdate(user._id, { token });

  res.json({
    token,
    user: {
      email: user.email,
      name: user.name,
      avatarURL: user.avatarURL,
    },
  });
};

const logout = async (req, res) => {
  const { _id } = req.user;
  const user = await User.findOne({ _id });
  if (!user) {
    throw HttpError(401, 'Not authorized');
  }

  await User.findByIdAndUpdate(_id, { token: null });

  res.status(204).send();
};

const current = (req, res) => {
  const { email, name, avatarURL } = req.user;

  res.json({
    email,
    name,
    avatarURL,
  });
};

const updateAvatar = async (req, res) => {
  const { _id } = req.user;
  const { path: tempUpload, originalname } = req.file;
  const filename = `${_id}_${originalname}`;
  const resultUpload = path.join(avatarsDir, filename);

  await fs.rename(tempUpload, resultUpload);

  const avatarURL = path.join('avatars', filename);
  await User.findByIdAndUpdate(_id, { avatarURL });

  res.json({
    avatarURL,
  });
};

module.exports = {
  test: controllerWrap(test),
  register: controllerWrap(register),
  login: controllerWrap(login),
  logout: controllerWrap(logout),
  current: controllerWrap(current),
  updateAvatar: controllerWrap(updateAvatar),
};
