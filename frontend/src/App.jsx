// 1. Fetch all tasks from the database
  const fetchTasks = async () => {
    try {
      const res = await axios.get('https://todo-backend-api-x8hm.onrender.com/tasks');
      setTasks(res.data);
    } catch (err) {
      console.error("Error fetching tasks:", err);
    }
  };

  // 2. Add a new task
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
      // Use backticks ` ` for the URL below to include the ${id}
      await axios.delete(`https://todo-backend-api-x8hm.onrender.com/tasks/${id}`);
      fetchTasks();
    } catch (err) {
      console.error("Error deleting task:", err);
    }
  };