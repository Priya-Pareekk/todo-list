const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const Task = require('./models/Task'); // Import the Model

const app = express();
app.use(cors()); // Allows frontend to talk to backend
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Database connected successfully!"))
  .catch(err => console.log("❌ DB Error:", err));

// --- ROUTES ---

// 1. Get all tasks
app.get('/tasks', async (req, res) => {
    const tasks = await Task.find();
    res.json(tasks);
});

// 2. Add a new task
app.post('/tasks', async (req, res) => {
    const newTask = new Task({ title: req.body.title });
    await newTask.save();
    res.json(newTask);
});

// 3. Delete a task
app.delete('/tasks/:id', async (req, res) => {
    await Task.findByIdAndDelete(req.params.id);
    res.json({ message: "Task deleted" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));