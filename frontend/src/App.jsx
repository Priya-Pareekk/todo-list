import { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [tasks, setTasks] = useState([]);
  const [input, setInput] = useState("");

  // 1. Fetch all tasks
  const fetchTasks = async () => {
    try {
      const res = await axios.get('https://todo-backend-api-x8hm.onrender.com/tasks');
      setTasks(res.data);
    } catch (err) {
      console.error("Error fetching tasks:", err);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // 2. Add a task
  const addTask = async () => {
    if (!input) return;
    try {
      await axios.post('https://todo-backend-api-x8hm.onrender.com/tasks', { title: input });
      setInput("");
      fetchTasks();
    } catch (err) {
      console.error("Error adding task:", err);
    }
  };

  // 3. Delete a task
  const deleteTask = async (id) => {
    try {
      // Use backticks ` ` for the URL below
      await axios.delete(`https://todo-backend-api-x8hm.onrender.com/tasks/${id}`);
      fetchTasks();
    } catch (err) {
      console.error("Error deleting task:", err);
    }
  };

  return (
    <div style={{ padding: '50px', textAlign: 'center' }}>
      <h1>My To-Do List</h1>
      <input 
        value={input} 
        onChange={(e) => setInput(e.target.value)} 
        placeholder="Enter a task..." 
        style={{ padding: '10px', width: '200px' }}
      />
      <button onClick={addTask} style={{ padding: '10px 20px', marginLeft: '10px' }}>Add</button>

      <ul style={{ listStyle: 'none', padding: 0, marginTop: '20px' }}>
        {tasks.map((task) => (
          <li key={task._id} style={{ marginBottom: '10px' }}>
            {task.title} 
            <button 
              onClick={() => deleteTask(task._id)} 
              style={{ marginLeft: '10px', color: 'red' }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;