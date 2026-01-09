import { useState, useEffect } from 'react'
import axios from 'axios'

function App() {
  const [tasks, setTasks] = useState([]);
  const [input, setInput] = useState("");

  // 1. Fetch tasks when page loads
  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await axios.delete(https://www.google.com/search?q=https://todo-backend-api-x8hm.onrender.com/tasks/${id});
      setTasks(res.data);
    } catch (err) {
      console.error("Error fetching tasks", err);
    }
  };

  // 2. Add a task
  const addTask = async () => {
    if (!input) return;
    await axios.post('https://todo-backend-api-x8hm.onrender.com/tasks', { title: input });
    setInput("");
    fetchTasks();
  };

  // 3. Delete a task
  const deleteTask = async (id) => {
    await axios.delete('https://todo-backend-api-x8hm.onrender.com/tasks/${id}');
    fetchTasks();
  };

  return (
    <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'Arial' }}>
      <h1>My To-Do List</h1>
      <input 
        value={input} 
        onChange={(e) => setInput(e.target.value)} 
        placeholder="Enter a task..." 
        style={{ padding: '10px', width: '200px' }}
      />
      <button onClick={addTask} style={{ padding: '10px 20px', marginLeft: '10px' }}>Add</button>

      <ul style={{ listStyle: 'none', padding: 0, marginTop: '20px' }}>
        {tasks.map(task => (
          <li key={task._id} style={{ marginBottom: '10px' }}>
            {task.title} 
            <button onClick={() => deleteTask(task._id)} style={{ marginLeft: '10px', color: 'red' }}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default App