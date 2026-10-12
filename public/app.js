// DOM Elements
const statHits = document.getElementById('stat-hits');
const statMisses = document.getElementById('stat-misses');
const statRate = document.getElementById('stat-rate');
const statInvalidations = document.getElementById('stat-invalidations');

const btnRefreshStats = document.getElementById('btn-refresh-stats');
const btnClearCache = document.getElementById('btn-clear-cache');
const btnSeed = document.getElementById('btn-seed');
const btnRunBenchmark = document.getElementById('btn-run-benchmark');

const btnFetchCached = document.getElementById('btn-fetch-cached');
const btnFetchUncached = document.getElementById('btn-fetch-uncached');

const createTaskForm = document.getElementById('create-task-form');
const taskTitle = document.getElementById('task-title');
const taskDesc = document.getElementById('task-desc');
const taskPriority = document.getElementById('task-priority');

const fetchIndicator = document.getElementById('fetch-indicator');
const tasksLoading = document.getElementById('tasks-loading');
const tasksList = document.getElementById('tasks-list');
const benchmarkBody = document.getElementById('benchmark-body');
const toast = document.getElementById('toast');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchTasks();
    refreshStats();

    btnRefreshStats.addEventListener('click', refreshStats);
    btnClearCache.addEventListener('click', handleClearCache);
    btnSeed.addEventListener('click', handleSeed);
    btnRunBenchmark.addEventListener('click', runBenchmark);

    btnFetchCached.addEventListener('click', () => fetchTasks(false));
    btnFetchUncached.addEventListener('click', () => fetchTasks(true));

    createTaskForm.addEventListener('submit', handleCreateTask);
});

// Toast notification
function showToast(msg, type = 'info') {
    toast.textContent = msg;
    toast.className = `toast ${type}`;
    setTimeout(() => {
        toast.className = 'toast hidden';
    }, 4000);
}

// Fetch Tasks and Measure Response Time
async function fetchTasks(bypass = false) {
    tasksLoading.classList.remove('hidden');
    fetchIndicator.classList.add('hidden');

    const startTime = performance.now();
    try {
        const url = bypass ? '/tasks?bypass=true' : '/tasks';
        const res = await fetch(url);
        const endTime = performance.now();
        const duration = (endTime - startTime).toFixed(1);

        const data = await res.json();
        const isHit = res.headers.get('X-Cache') === 'HIT' || data.source === 'cache';

        fetchIndicator.className = `fetch-indicator ${isHit ? 'hit' : 'miss'}`;
        fetchIndicator.innerHTML = `
            ${isHit ? '⚡ CACHE HIT (node-cache)' : '🔍 CACHE MISS (Queried MongoDB)'} 
            &bull; Response Time: <strong>${duration} ms</strong> &bull; Tasks: ${data.count || 0}
        `;
        fetchIndicator.classList.remove('hidden');

        renderTasks(data.tasks || []);
        refreshStats();
    } catch (err) {
        showToast('Error fetching tasks: ' + err.message, 'error');
    } finally {
        tasksLoading.classList.add('hidden');
    }
}

// Render task list
function renderTasks(tasks) {
    if (tasks.length === 0) {
        tasksList.innerHTML = '<li style="text-align: center; color: #888; padding: 12px;">No tasks found. Create one or click "Seed 6 Tasks".</li>';
        return;
    }

    tasksList.innerHTML = tasks.map(t => `
        <li class="task-item ${t.completed ? 'completed' : ''}" data-id="${t._id}">
            <div>
                <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="toggleTask('${t._id}', this.checked)" style="margin-right: 8px;">
                <span class="title">${escapeHtml(t.title)}</span>
                <span class="priority-badge priority-${t.priority || 'medium'}">${t.priority || 'medium'}</span>
                ${t.description ? `<p style="font-size: 0.75rem; color: #718096; margin-left: 24px;">${escapeHtml(t.description)}</p>` : ''}
            </div>
            <button class="btn btn-sm btn-danger" onclick="deleteTask('${t._id}')">Delete</button>
        </li>
    `).join('');
}

// Create Task (Triggers server-side cache.del('all_tasks'))
async function handleCreateTask(e) {
    e.preventDefault();
    const title = taskTitle.value.trim();
    if (!title) return;

    try {
        const res = await fetch('/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                description: taskDesc.value.trim(),
                priority: taskPriority.value
            })
        });

        const data = await res.json();
        if (data.success) {
            showToast('Task created! Cache "all_tasks" key was invalidated.', 'success');
            createTaskForm.reset();
            fetchTasks();
        } else {
            showToast(data.message || 'Error creating task', 'error');
        }
    } catch (err) {
        showToast('Network error: ' + err.message, 'error');
    }
}

// Toggle Task
async function toggleTask(id, completed) {
    try {
        const res = await fetch(`/tasks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Task updated & cache invalidated!', 'info');
            fetchTasks();
        }
    } catch (err) {
        showToast('Error updating: ' + err.message, 'error');
    }
}

// Delete Task
async function deleteTask(id) {
    if (!confirm('Delete this task?')) return;
    try {
        const res = await fetch(`/tasks/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast('Task deleted & cache invalidated!', 'info');
            fetchTasks();
        }
    } catch (err) {
        showToast('Error deleting: ' + err.message, 'error');
    }
}

// Refresh Live Cache Stats
async function refreshStats() {
    try {
        const res = await fetch('/api/cache-stats');
        const data = await res.json();
        if (data.success) {
            statHits.textContent = data.summary.hits;
            statMisses.textContent = data.summary.misses;
            statRate.textContent = data.summary.hitRate;
            statInvalidations.textContent = data.summary.invalidations;
        }
    } catch (err) {}
}

// Flush Cache
async function handleClearCache() {
    try {
        const res = await fetch('/api/cache-clear', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast('All cache keys flushed!', 'info');
            refreshStats();
        }
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

// Seed Tasks
async function handleSeed() {
    try {
        const res = await fetch('/api/seed-tasks', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            fetchTasks();
        }
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

// 3x3 Benchmark Test (Rubric requirement)
async function runBenchmark() {
    benchmarkBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #2b6cb0;">Running 3 Uncached & 3 Cached requests...</td></tr>';
    
    // First ensure there is at least one cache miss to warm up the cache
    await fetch('/tasks');

    const uncachedTimes = [];
    const cachedTimes = [];

    // 1. Run 3 uncached requests
    for (let i = 0; i < 3; i++) {
        const t0 = performance.now();
        await fetch('/tasks?bypass=true');
        const t1 = performance.now();
        uncachedTimes.push(t1 - t0);
    }

    // 2. Run 3 cached requests
    for (let i = 0; i < 3; i++) {
        const t0 = performance.now();
        await fetch('/tasks');
        const t1 = performance.now();
        cachedTimes.push(t1 - t0);
    }

    const avgUncached = (uncachedTimes.reduce((a, b) => a + b, 0) / 3).toFixed(1);
    const avgCached = (cachedTimes.reduce((a, b) => a + b, 0) / 3).toFixed(1);
    const speedup = (avgUncached / avgCached).toFixed(1);

    benchmarkBody.innerHTML = `
        <tr>
            <td>Sample 1</td>
            <td><span class="tag-miss">${uncachedTimes[0].toFixed(1)} ms</span></td>
            <td><span class="tag-hit">${cachedTimes[0].toFixed(1)} ms</span></td>
            <td>${(uncachedTimes[0] / cachedTimes[0]).toFixed(1)}x faster</td>
        </tr>
        <tr>
            <td>Sample 2</td>
            <td><span class="tag-miss">${uncachedTimes[1].toFixed(1)} ms</span></td>
            <td><span class="tag-hit">${cachedTimes[1].toFixed(1)} ms</span></td>
            <td>${(uncachedTimes[1] / cachedTimes[1]).toFixed(1)}x faster</td>
        </tr>
        <tr>
            <td>Sample 3</td>
            <td><span class="tag-miss">${uncachedTimes[2].toFixed(1)} ms</span></td>
            <td><span class="tag-hit">${cachedTimes[2].toFixed(1)} ms</span></td>
            <td>${(uncachedTimes[2] / cachedTimes[2]).toFixed(1)}x faster</td>
        </tr>
        <tr class="average-row">
            <td><strong>Average</strong></td>
            <td><strong>${avgUncached} ms</strong></td>
            <td><strong>${avgCached} ms</strong></td>
            <td><strong style="color: #276749;">~${speedup}x faster</strong></td>
        </tr>
    `;

    refreshStats();
    showToast(`Benchmark complete! Cached response is ~${speedup}x faster.`, 'success');
}

// Utility: Escape HTML
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
}
