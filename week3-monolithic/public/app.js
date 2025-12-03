// ========================================
// PART 1: STATE MANAGEMENT
// ========================================

// TODO 1.1: Declare global variables for state
let allTasks = [];
let currentFilter = 'ALL';


// ========================================
// PART 2: DOM ELEMENTS
// ========================================

// TODO 2.1: Get references to DOM elements
const addTaskForm = document.getElementById('addTaskForm');
const statusFilter = document.getElementById('statusFilter');
const loadingOverlay = document.getElementById('loadingOverlay');

// Task list containers
const todoTasks = document.getElementById('todoTasks');
const progressTasks = document.getElementById('progressTasks');
const doneTasks = document.getElementById('doneTasks');

// Task counters
const todoCount = document.getElementById('todoCount');
const progressCount = document.getElementById('progressCount');
const doneCount = document.getElementById('doneCount');

// ========================================
// PART 3: API FUNCTIONS - FETCH TASKS
// ========================================

// TODO 3.1: Create async function to fetch all tasks from API
// This function should:
// 1. Show loading overlay
// 2. Fetch from '/api/tasks'
// 3. Update allTasks array
// 4. Call renderTasks()
// 5. Hide loading overlay
// 6. Handle errors

async function fetchTasks() {
    showLoading();
    try {
        const response = await fetch('/api/tasks');

        if (!response.ok) {
            throw new Error('Failed to fetch tasks, status = ' + response.status);
        }

        const data = await response.json();
        console.log('Tasks API response:', data);

        // รองรับหลายรูปแบบ:
        // 1) [ {...}, {...} ]
        // 2) { tasks: [ {...}, {...} ] }
        // 3) { success: true, data: [ {...}, {...} ] }
        if (Array.isArray(data)) {
            allTasks = data;
        } else if (Array.isArray(data.tasks)) {
            allTasks = data.tasks;
        } else if (Array.isArray(data.data)) {
            allTasks = data.data;
        } else {
            console.error('Unexpected tasks response format:', data);
            allTasks = []; // กันไม่ให้ renderTasks พัง
        }

        renderTasks();
    } catch (error) {
        console.error('Error fetching tasks:', error);
        alert('Failed to load tasks. Please refresh the page.');
    } finally {
        hideLoading();
    }
}

// ========================================
// PART 4: API FUNCTIONS - CREATE TASK
// ========================================

// TODO 4.1: Create async function to create a new task
// Parameters: taskData (object with title, description, priority)
// This function should:
// 1. Show loading overlay
// 2. POST to '/api/tasks' with taskData
// 3. Add new task to allTasks array
// 4. Call renderTasks()
// 5. Reset the form
// 6. Show success message
// 7. Hide loading overlay

async function createTask(taskData) { 
    showLoading();
    try {
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(taskData)
        });

        let data = null;
        try {
            data = await response.json();
        } catch (e) {
            console.error('Create task: cannot parse JSON response', e);
        }

        console.log('Create task API response:', response.status, data);

        // เช็ก success จากทั้ง status code และ field success ของ backend
        if (!response.ok || !data || data.success === false) {
            const msg = data && data.message ? data.message : 'Failed to create task';
            throw new Error(msg);
        }

        // ✅ กรณีที่ 1: backend ส่ง "array ของ task ทั้งหมด" กลับมา
        if (Array.isArray(data.data)) {
            allTasks = data.data;      // อัปเดตรายการทั้งหมดจาก server
        } else if (Array.isArray(data.tasks)) {
            allTasks = data.tasks;     // เผื่อมีรูปแบบอื่นในอนาคต
        } else if (Array.isArray(data)) {
            allTasks = data;           // กันเผื่อ backend ส่ง array ตรง ๆ
        } else {
            // ✅ กรณีที่ 2: backend ส่ง "task เดียว" กลับมา
            // เช่น { success: true, data: { id: 5, title: '...', ... } }
            const newTask = data?.data ?? data?.task ?? data;

            if (!newTask || typeof newTask !== 'object') {
                console.error('Unexpected create task response format:', data);
                throw new Error('Invalid task data from server');
            }

            // เพิ่ม task ใหม่ไว้บนสุดของ list เดิม
            allTasks.unshift(newTask);
        }

        renderTasks();

        // รีเซ็ตฟอร์ม
        addTaskForm.reset();

        alert('✅ Task created successfully!');
    } catch (error) {
        console.error('Error creating task:', error);
        alert('❌ Failed to create task. Please try again.');
    } finally {
        hideLoading();
    }
}


// ========================================
// PART 5: API FUNCTIONS - UPDATE STATUS
// ========================================

async function updateTaskStatus(taskId, newStatus) {
    showLoading();
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT', // ถ้า backend ใช้ PATCH ก็เปลี่ยนเป็น 'PATCH' ได้
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });

        let data = null;
        try {
            data = await response.json();
        } catch (e) {
            console.error('Update status: cannot parse JSON response', e);
        }

        console.log('Update status API response:', response.status, data);

        // ถ้า status code ไม่ใช่ 2xx หรือ backend ส่ง success: false -> error
        if (!response.ok || (data && data.success === false)) {
            const msg = data && data.message ? data.message : 'Failed to update task status';
            throw new Error(msg);
        }

        // ถ้า backend ส่ง tasks ทั้งหมดกลับมา (แบบเดียวกับ createTask)
        if (data && Array.isArray(data.data)) {
            // กรณีรูปแบบ: { success: true, data: [ ...all tasks... ] }
            allTasks = data.data;
        } else if (data && Array.isArray(data.tasks)) {
            // กันไว้เผื่อ backend ใช้ field tasks แทน data
            allTasks = data.tasks;
        } else {
            // ถ้า backend ส่งแค่ task เดียวกลับมา
            const updatedTask = data?.data ?? data?.task ?? data;

            if (updatedTask && typeof updatedTask === 'object') {
                const index = allTasks.findIndex(t => t.id === taskId);
                if (index !== -1) {
                    allTasks[index] = {
                        ...allTasks[index],
                        ...updatedTask
                    };
                }
            } else {
                console.warn('Unexpected update status response format, updating local state manually');
                const index = allTasks.findIndex(t => t.id === taskId);
                if (index !== -1) {
                    allTasks[index] = {
                        ...allTasks[index],
                        status: newStatus
                    };
                }
            }
        }

        renderTasks();
    } catch (error) {
        console.error('Error updating task status:', error);
        alert('❌ Failed to update task status. Please try again.');
    } finally {
        hideLoading();
    }
}

// ========================================
// PART 6: API FUNCTIONS - DELETE TASK
// ========================================

// TODO 6.1: Create async function to delete a task
// Parameters: taskId (number)
// This function should:
// 1. Confirm with user
// 2. Show loading overlay
// 3. DELETE to '/api/tasks/:id'
// 4. Remove task from allTasks array
// 5. Call renderTasks()
// 6. Show success message
// 7. Hide loading overlay

async function deleteTask(taskId) {
    if (!confirm('Are you sure you want to delete this task?')) {
        return;
    }

    showLoading();
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to delete task');
        }

        // ลบออกจาก state ฝั่ง frontend
        allTasks = allTasks.filter(task => task.id !== taskId);

        renderTasks();

        alert('🗑️ Task deleted successfully!');
    } catch (error) {
        console.error('Error deleting task:', error);
        alert('❌ Failed to delete task. Please try again.');
    } finally {
        hideLoading();
    }
}

// ========================================
// PART 7: RENDER FUNCTIONS - MAIN RENDER
// ========================================

// TODO 7.1: Create function to render all tasks
// This function should:
// 1. Clear all task lists
// 2. Filter tasks based on currentFilter
// 3. Separate tasks by status (TODO, IN_PROGRESS, DONE)
// 4. Update counters
// 5. Call renderTaskList() for each column

function renderTasks() {
    // Clear all lists
    todoTasks.innerHTML = '';
    progressTasks.innerHTML = '';
    doneTasks.innerHTML = '';
    
    // Filter tasks
    let filteredTasks = allTasks;
    if (currentFilter !== 'ALL') {
        filteredTasks = allTasks.filter(task => task.status === currentFilter);
    }
    
    // Separate by status
    const todo = filteredTasks.filter(t => t.status === 'TODO');
    const progress = filteredTasks.filter(t => t.status === 'IN_PROGRESS');
    const done = filteredTasks.filter(t => t.status === 'DONE');
    
    // Update counters
    todoCount.textContent = todo.length;
    progressCount.textContent = progress.length;
    doneCount.textContent = done.length;
    
    // Render each column
    renderTaskList(todo, todoTasks, 'TODO');
    renderTaskList(progress, progressTasks, 'IN_PROGRESS');
    renderTaskList(done, doneTasks, 'DONE');
}

// ========================================
// PART 8: RENDER FUNCTIONS - RENDER LIST
// ========================================

// TODO 8.1: Create function to render a list of tasks
// Parameters: tasks (array), container (DOM element), currentStatus (string)
// This function should:
// 1. Show empty state if no tasks
// 2. Loop through tasks and create cards
// 3. Append cards to container


function renderTaskList(tasks, container, currentStatus) {
    if (tasks.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No tasks yet</p></div>';
        return;
    }
    
    tasks.forEach(task => {
        const card = createTaskCard(task, currentStatus);
        container.appendChild(card);
    });
}

// ========================================
// PART 9: RENDER FUNCTIONS - CREATE CARD
// ========================================

// TODO 9.1: Create function to create a task card element
// Parameters: task (object), currentStatus (string)
// Returns: DOM element (div.task-card)
// This function should:
// 1. Create div element
// 2. Set innerHTML with task data
// 3. Include status buttons based on current status
// 4. Include delete button
// 5. Return the element

function createTaskCard(task, currentStatus) {
    const card = document.createElement('div');
    card.className = 'task-card';
    
    const priorityClass = `priority-${task.priority.toLowerCase()}`;
    
    card.innerHTML = `
        <div class="task-header">
            <div class="task-title">${escapeHtml(task.title)}</div>
            <span class="priority-badge ${priorityClass}">${task.priority}</span>
        </div>
        ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ''}
        <div class="task-meta">
            Created: ${formatDate(task.created_at)}
        </div>
        <div class="task-actions">
            ${createStatusButtons(task.id, currentStatus)}
            <button class="btn btn-danger btn-sm" onclick="deleteTask(${task.id})">
                🗑️ Delete
            </button>
        </div>
    `;
    
    return card;
}

// ========================================
// PART 10: HELPER FUNCTIONS - STATUS BUTTONS
// ========================================

// TODO 10.1: Create function to generate status buttons HTML
// Parameters: taskId (number), currentStatus (string)
// Returns: HTML string
// This function should create buttons based on current status:
// - If TODO: show "→ In Progress" and "→ Done"
// - If IN_PROGRESS: show "← To Do" and "→ Done"
// - If DONE: show "← To Do" and "← In Progress"

function createStatusButtons(taskId, currentStatus) { 
    const buttons = [];

    if (currentStatus === 'TODO') {
        // If TODO: show "→ In Progress" and "→ Done"
        buttons.push(`
            <button class="btn btn-info btn-sm" onclick="updateTaskStatus(${taskId}, 'IN_PROGRESS')">
                → In Progress
            </button>
        `);
        buttons.push(`
            <button class="btn btn-success btn-sm" onclick="updateTaskStatus(${taskId}, 'DONE')">
                → Done
            </button>
        `);
    } else if (currentStatus === 'IN_PROGRESS') {
        // If IN_PROGRESS: show "← To Do" and "→ Done"
        buttons.push(`
            <button class="btn btn-warning btn-sm" onclick="updateTaskStatus(${taskId}, 'TODO')">
                ← To Do
            </button>
        `);
        buttons.push(`
            <button class="btn btn-success btn-sm" onclick="updateTaskStatus(${taskId}, 'DONE')">
                → Done
            </button>
        `);
    } else if (currentStatus === 'DONE') {
        // If DONE: show "← To Do" and "← In Progress"
        buttons.push(`
            <button class="btn btn-warning btn-sm" onclick="updateTaskStatus(${taskId}, 'TODO')">
                ← To Do
            </button>
        `);
        buttons.push(`
            <button class="btn btn-info btn-sm" onclick="updateTaskStatus(${taskId}, 'IN_PROGRESS')">
                ← In Progress
            </button>
        `);
    }

    return buttons.join('');
}

// ========================================
// PART 11: UTILITY FUNCTIONS
// ========================================

// TODO 11.1: Create utility functions
// escapeHtml(text) - Prevents XSS attacks by escaping HTML
// formatDate(dateString) - Formats date nicely
// showLoading() - Shows loading overlay
// hideLoading() - Hides loading overlay

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showLoading() {
    loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    loadingOverlay.style.display = 'none';
}

// ========================================
// PART 12: EVENT LISTENERS
// ========================================

// TODO 12.1: Add event listener for form submission
// Should prevent default, get form data, and call createTask()

addTaskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const title = document.getElementById('taskTitle').value.trim();
    const description = document.getElementById('taskDescription').value.trim();
    const priority = document.getElementById('taskPriority').value;
    
    if (!title) {
        alert('Please enter a task title');
        return;
    }
    
    createTask({ title, description, priority });
});

// TODO 12.2: Add event listener for status filter
// Should update currentFilter and call renderTasks()

statusFilter.addEventListener('change', (e) => {
    currentFilter = e.target.value;
    renderTasks();
});

// ========================================
// PART 13: INITIALIZATION
// ========================================

// TODO 13.1: Add DOMContentLoaded event listener
// This runs when the page is fully loaded
// Should call fetchTasks() to load initial data

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Task Board App Initialized');
    console.log('📊 Architecture: Monolithic');
    fetchTasks();
});

// ========================================
// PART 14: GLOBAL FUNCTION EXPOSURE
// ========================================

// TODO 14.1: Make functions globally accessible for inline event handlers
// This is needed for onclick attributes in HTML

window.updateTaskStatus = updateTaskStatus;
window.deleteTask = deleteTask;

