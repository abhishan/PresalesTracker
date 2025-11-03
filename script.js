// ===========================
// Constants
// ===========================

const DATA_VERSION = 2; // Current data schema version

const BANT_THRESHOLDS = {
    HOT: 80,
    WARM: 55
};

const MAX_BANT_SCORE = 20;

// ===========================
// Data Storage & State
// ===========================

let opportunities = [];
let tasks = [];
let currentEditingOpportunity = null;
let currentEditingTask = null;
let currentCalendarDate = new Date();
let selectedCalendarDate = null;
let draggedCard = null;
let undoStack = [];
const MAX_UNDO_STACK = 10;
let opportunitySortColumn = null;
let opportunitySortDirection = 'asc';
let taskSortColumn = null;
let taskSortDirection = 'asc';
let selectedOpportunities = new Set();
let selectedTasks = new Set();

// ===========================
// Initialization
// ===========================

document.addEventListener('DOMContentLoaded', function() {
    loadDataFromStorage();
    initializeEventListeners();
    initializeCalendar();
    initializeKanban();
    renderOpportunities();
    renderTasks();
    updateDashboard();
    updateTaskOpportunityFilters();

    // Check storage quota on load
    checkStorageQuota();
});

// ===========================
// Local Storage Functions
// ===========================

function loadDataFromStorage() {
    try {
        const storedOpportunities = localStorage.getItem('opportunities');
        const storedTasks = localStorage.getItem('tasks');
        const storedVersion = localStorage.getItem('dataVersion');

        opportunities = storedOpportunities ? JSON.parse(storedOpportunities) : [];
        tasks = storedTasks ? JSON.parse(storedTasks) : [];

        // Check if migration is needed
        const currentVersion = storedVersion ? parseInt(storedVersion) : 1;
        if (currentVersion < DATA_VERSION) {
            migrateData(currentVersion, DATA_VERSION);
            localStorage.setItem('dataVersion', DATA_VERSION.toString());
        }
    } catch (error) {
        console.error('Error loading data from storage:', error);
        opportunities = [];
        tasks = [];
    }
}

function saveOpportunitiesToStorage() {
    try {
        localStorage.setItem('opportunities', JSON.stringify(opportunities));
        checkStorageQuota();
    } catch (error) {
        console.error('Error saving opportunities:', error);
        alert('Unable to save data. Storage may be full.');
    }
}

function saveTasksToStorage() {
    try {
        localStorage.setItem('tasks', JSON.stringify(tasks));
        checkStorageQuota();
    } catch (error) {
        console.error('Error saving tasks:', error);
        alert('Unable to save data. Storage may be full.');
    }
}

// ===========================
// Data Migration Functions
// ===========================

const migrations = {
    1: function(data) {
        // Migration from v1 to v2: Ensure all opportunities have proper ID format
        console.log('Migrating from version 1 to 2...');
        return data;
    }
};

function migrateData(fromVersion, toVersion) {
    console.log(`Migrating data from version ${fromVersion} to ${toVersion}`);

    for (let v = fromVersion; v < toVersion; v++) {
        if (migrations[v]) {
            const result = migrations[v]({ opportunities, tasks });
            if (result) {
                opportunities = result.opportunities || opportunities;
                tasks = result.tasks || tasks;
            }
        }
    }

    // Save migrated data
    saveOpportunitiesToStorage();
    saveTasksToStorage();

    console.log('Data migration completed successfully');
}

// ===========================
// ID Generators
// ===========================

function generateOpportunityID() {
    const year = new Date().getFullYear();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const timestamp = Date.now();
    return `OP-${year}-${random}-${timestamp}`;
}

function generateTaskID() {
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    const timestamp = Date.now();
    return `TSK-${random}-${timestamp}`;
}

// ===========================
// Utility Functions
// ===========================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

function formatCurrency(amount) {
    return amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function checkStorageQuota() {
    try {
        let totalSize = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                totalSize += localStorage[key].length + key.length;
            }
        }

        // Convert to KB
        const sizeInKB = totalSize / 1024;
        const sizeInMB = sizeInKB / 1024;

        // Typical localStorage limit is 5-10MB, warn at 80%
        const estimatedLimit = 5 * 1024; // 5MB in KB
        const usagePercent = (sizeInKB / estimatedLimit) * 100;

        if (usagePercent > 80) {
            showWarning(`Storage is ${usagePercent.toFixed(1)}% full (${sizeInMB.toFixed(2)}MB). Consider exporting your data.`);
        }

        return {
            sizeInKB: sizeInKB.toFixed(2),
            sizeInMB: sizeInMB.toFixed(2),
            usagePercent: usagePercent.toFixed(1)
        };
    } catch (error) {
        console.error('Error checking storage quota:', error);
        return null;
    }
}

function showWarning(message) {
    // Create warning toast
    const toast = document.createElement('div');
    toast.className = 'toast toast-warning';
    toast.innerHTML = `
        <span>${escapeHtml(message)}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    document.body.appendChild(toast);

    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 10000);
}

// ===========================
// Data Export/Import Functions
// ===========================

function exportToJSON() {
    const data = {
        version: DATA_VERSION,
        exportDate: new Date().toISOString(),
        opportunities: opportunities,
        tasks: tasks
    };

    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `presales-tracker-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showSuccess('Data exported successfully!');
}

function exportToCSV() {
    // Export opportunities to CSV
    const oppHeaders = ['ID', 'Name', 'Client', 'Industry', 'Sales Owner', 'Pre-Sales Owner', 'BA',
                        'Tech Type', 'Source', 'Date Identified', 'Expected Close', 'Stage', 'Status',
                        'Deal Value', 'Probability', 'Expected Revenue', 'BANT Total', 'BANT %', 'BANT Summary'];

    let oppCSV = oppHeaders.join(',') + '\n';

    opportunities.forEach(opp => {
        const row = [
            opp.id,
            `"${opp.name}"`,
            `"${opp.client}"`,
            opp.industry,
            `"${opp.salesOwner || ''}"`,
            `"${opp.preSalesOwner || ''}"`,
            `"${opp.ba || ''}"`,
            opp.techType,
            opp.source,
            opp.dateIdentified,
            opp.expectedClose,
            opp.stage,
            opp.status,
            opp.dealValue,
            opp.probability,
            opp.expectedRevenue.toFixed(2),
            opp.bantTotal,
            opp.bantPercent.toFixed(2),
            opp.bantSummary
        ];
        oppCSV += row.join(',') + '\n';
    });

    // Export tasks to CSV
    const taskHeaders = ['ID', 'Opportunity ID', 'Task Name', 'Assigned To', 'Role', 'Task Type',
                         'Start Date', 'Due Date', 'Status', 'Remarks'];

    let taskCSV = taskHeaders.join(',') + '\n';

    tasks.forEach(task => {
        const row = [
            task.id,
            task.opportunityId,
            `"${task.taskName}"`,
            `"${task.assignedTo || ''}"`,
            task.role,
            task.taskType,
            task.startDate || '',
            task.dueDate || '',
            task.status,
            `"${(task.remarks || '').replace(/"/g, '""')}"`
        ];
        taskCSV += row.join(',') + '\n';
    });

    // Download opportunities CSV
    downloadCSV(oppCSV, `opportunities-${new Date().toISOString().split('T')[0]}.csv`);

    // Download tasks CSV
    downloadCSV(taskCSV, `tasks-${new Date().toISOString().split('T')[0]}.csv`);

    showSuccess('Data exported to CSV successfully!');
}

function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function importFromJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);

                // Validate data structure
                if (!data.opportunities || !data.tasks) {
                    throw new Error('Invalid data format');
                }

                // Check version and migrate if needed
                const importVersion = data.version || 1;
                if (importVersion < DATA_VERSION) {
                    showWarning('Importing older data format. Data will be migrated.');
                }

                // Confirm before overwriting
                if (!confirm('This will replace all existing data. Are you sure you want to continue?')) {
                    return;
                }

                opportunities = data.opportunities;
                tasks = data.tasks;

                // Migrate if needed
                if (importVersion < DATA_VERSION) {
                    migrateData(importVersion, DATA_VERSION);
                } else {
                    saveOpportunitiesToStorage();
                    saveTasksToStorage();
                }

                // Refresh UI
                renderOpportunities();
                renderTasks();
                updateTaskOpportunityFilters();
                updateDashboard();

                showSuccess('Data imported successfully!');
            } catch (error) {
                console.error('Import error:', error);
                alert('Failed to import data. Please check the file format.');
            }
        };
        reader.readAsText(file);
    };

    input.click();
}

function showSuccess(message) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-success';
    toast.innerHTML = `
        <span>${escapeHtml(message)}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

function showLoading(message = 'Loading...') {
    // Remove existing loading overlay if any
    const existing = document.getElementById('loading-overlay');
    if (existing) {
        existing.remove();
    }

    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
        <div style="text-align: center; color: white;">
            <div class="spinner"></div>
            <p style="margin-top: 1rem;">${escapeHtml(message)}</p>
        </div>
    `;
    document.body.appendChild(overlay);
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// ===========================
// Undo/Redo Functions
// ===========================

function addToUndoStack(action) {
    undoStack.push(action);

    // Limit stack size
    if (undoStack.length > MAX_UNDO_STACK) {
        undoStack.shift();
    }
}

function undo() {
    if (undoStack.length === 0) {
        showWarning('Nothing to undo');
        return;
    }

    const action = undoStack.pop();

    switch (action.type) {
        case 'delete_opportunity':
            // Restore opportunity and its tasks
            opportunities.push(action.data.opportunity);
            if (action.data.tasks && action.data.tasks.length > 0) {
                tasks.push(...action.data.tasks);
            }
            saveOpportunitiesToStorage();
            saveTasksToStorage();
            renderOpportunities();
            renderTasks();
            updateTaskOpportunityFilters();
            updateDashboard();
            showSuccess('Opportunity restored');
            break;

        case 'delete_task':
            // Restore task
            tasks.push(action.data.task);
            saveTasksToStorage();
            renderTasks();
            updateDashboard();
            showSuccess('Task restored');
            break;

        case 'bulk_delete_opportunities':
            // Restore multiple opportunities
            opportunities.push(...action.data.opportunities);
            if (action.data.tasks && action.data.tasks.length > 0) {
                tasks.push(...action.data.tasks);
            }
            saveOpportunitiesToStorage();
            saveTasksToStorage();
            renderOpportunities();
            renderTasks();
            updateTaskOpportunityFilters();
            updateDashboard();
            showSuccess(`${action.data.opportunities.length} opportunities restored`);
            break;

        case 'bulk_delete_tasks':
            // Restore multiple tasks
            tasks.push(...action.data.tasks);
            saveTasksToStorage();
            renderTasks();
            updateDashboard();
            showSuccess(`${action.data.tasks.length} tasks restored`);
            break;
    }
}

function showUndoToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-success';
    toast.innerHTML = `
        <span>${escapeHtml(message)}</span>
        <button class="btn-undo" onclick="undo(); this.parentElement.remove();">Undo</button>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 8000);
}

// ===========================
// Sorting Functions
// ===========================

function sortOpportunities(column) {
    // Toggle direction if clicking same column
    if (opportunitySortColumn === column) {
        opportunitySortDirection = opportunitySortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        opportunitySortColumn = column;
        opportunitySortDirection = 'asc';
    }

    opportunities.sort((a, b) => {
        let aVal, bVal;

        switch (column) {
            case 'id':
                aVal = a.id;
                bVal = b.id;
                break;
            case 'name':
                aVal = a.name.toLowerCase();
                bVal = b.name.toLowerCase();
                break;
            case 'client':
                aVal = a.client.toLowerCase();
                bVal = b.client.toLowerCase();
                break;
            case 'industry':
                aVal = a.industry;
                bVal = b.industry;
                break;
            case 'stage':
                aVal = a.stage;
                bVal = b.stage;
                break;
            case 'status':
                aVal = a.status;
                bVal = b.status;
                break;
            case 'dealValue':
                aVal = a.dealValue;
                bVal = b.dealValue;
                break;
            case 'probability':
                aVal = a.probability;
                bVal = b.probability;
                break;
            case 'expectedRevenue':
                aVal = a.expectedRevenue;
                bVal = b.expectedRevenue;
                break;
            case 'bantPercent':
                aVal = a.bantPercent;
                bVal = b.bantPercent;
                break;
            case 'bantSummary':
                aVal = a.bantSummary;
                bVal = b.bantSummary;
                break;
            default:
                return 0;
        }

        if (aVal < bVal) return opportunitySortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return opportunitySortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    renderOpportunities();
    updateSortIndicators('opportunities', column, opportunitySortDirection);
}

function sortTasks(column) {
    // Toggle direction if clicking same column
    if (taskSortColumn === column) {
        taskSortDirection = taskSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        taskSortColumn = column;
        taskSortDirection = 'asc';
    }

    tasks.sort((a, b) => {
        let aVal, bVal;

        switch (column) {
            case 'id':
                aVal = a.id;
                bVal = b.id;
                break;
            case 'taskName':
                aVal = a.taskName.toLowerCase();
                bVal = b.taskName.toLowerCase();
                break;
            case 'assignedTo':
                aVal = (a.assignedTo || '').toLowerCase();
                bVal = (b.assignedTo || '').toLowerCase();
                break;
            case 'role':
                aVal = a.role;
                bVal = b.role;
                break;
            case 'taskType':
                aVal = a.taskType;
                bVal = b.taskType;
                break;
            case 'startDate':
                aVal = a.startDate || '';
                bVal = b.startDate || '';
                break;
            case 'dueDate':
                aVal = a.dueDate || '';
                bVal = b.dueDate || '';
                break;
            case 'status':
                aVal = a.status;
                bVal = b.status;
                break;
            default:
                return 0;
        }

        if (aVal < bVal) return taskSortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return taskSortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    renderTasks();
    updateSortIndicators('tasks', column, taskSortDirection);
}

function updateSortIndicators(table, column, direction) {
    const tableId = table === 'opportunities' ? 'opportunities-table' : 'tasks-table';
    const headers = document.querySelectorAll(`#${tableId} th`);

    headers.forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
        const sortIcon = th.querySelector('.sort-icon');
        if (sortIcon) {
            sortIcon.remove();
        }
    });

    const columnMap = {
        opportunities: {
            'id': 0, 'name': 1, 'client': 2, 'industry': 3, 'stage': 4,
            'status': 5, 'dealValue': 6, 'probability': 7, 'expectedRevenue': 8,
            'bantPercent': 9, 'bantSummary': 10
        },
        tasks: {
            'id': 0, 'taskName': 2, 'assignedTo': 3, 'role': 4,
            'taskType': 5, 'startDate': 6, 'dueDate': 7, 'status': 8
        }
    };

    const colIndex = columnMap[table][column];
    if (colIndex !== undefined) {
        const header = headers[colIndex];
        header.classList.add(`sorted-${direction}`);

        const icon = document.createElement('span');
        icon.className = 'sort-icon';
        icon.textContent = direction === 'asc' ? ' ▲' : ' ▼';
        header.appendChild(icon);
    }
}

// ===========================
// Bulk Operations Functions
// ===========================

function toggleOpportunitySelection(id) {
    if (selectedOpportunities.has(id)) {
        selectedOpportunities.delete(id);
    } else {
        selectedOpportunities.add(id);
    }
    updateBulkActionsUI('opportunities');
}

function toggleTaskSelection(id) {
    if (selectedTasks.has(id)) {
        selectedTasks.delete(id);
    } else {
        selectedTasks.add(id);
    }
    updateBulkActionsUI('tasks');
}

function toggleSelectAllOpportunities() {
    const tbody = document.getElementById('opportunities-tbody');
    const checkboxes = tbody.querySelectorAll('input[type="checkbox"]');

    if (selectedOpportunities.size === checkboxes.length) {
        // Deselect all
        selectedOpportunities.clear();
    } else {
        // Select all
        checkboxes.forEach(cb => {
            selectedOpportunities.add(cb.dataset.id);
        });
    }

    updateBulkActionsUI('opportunities');
    renderOpportunities();
}

function toggleSelectAllTasks() {
    const tbody = document.getElementById('tasks-tbody');
    const checkboxes = tbody.querySelectorAll('input[type="checkbox"]');

    if (selectedTasks.size === checkboxes.length) {
        // Deselect all
        selectedTasks.clear();
    } else {
        // Select all
        checkboxes.forEach(cb => {
            selectedTasks.add(cb.dataset.id);
        });
    }

    updateBulkActionsUI('tasks');
    renderTasks();
}

function updateBulkActionsUI(type) {
    const selectedCount = type === 'opportunities' ? selectedOpportunities.size : selectedTasks.size;
    const bulkActionsId = type === 'opportunities' ? 'opp-bulk-actions' : 'task-bulk-actions';
    const bulkActions = document.getElementById(bulkActionsId);

    if (selectedCount > 0) {
        bulkActions.style.display = 'flex';
        bulkActions.querySelector('.selected-count').textContent = `${selectedCount} selected`;
    } else {
        bulkActions.style.display = 'none';
    }
}

function bulkDeleteOpportunities() {
    if (selectedOpportunities.size === 0) return;

    if (!confirm(`Delete ${selectedOpportunities.size} opportunities and their associated tasks?`)) {
        return;
    }

    const deletedOpportunities = [];
    const deletedTasks = [];

    selectedOpportunities.forEach(id => {
        const opp = opportunities.find(o => o.id === id);
        if (opp) {
            deletedOpportunities.push(opp);
            const oppTasks = tasks.filter(t => t.opportunityId === id);
            deletedTasks.push(...oppTasks);
        }
    });

    // Add to undo stack
    addToUndoStack({
        type: 'bulk_delete_opportunities',
        data: {
            opportunities: deletedOpportunities,
            tasks: deletedTasks
        }
    });

    // Delete opportunities
    opportunities = opportunities.filter(opp => !selectedOpportunities.has(opp.id));
    tasks = tasks.filter(task => !deletedOpportunities.find(opp => opp.id === task.opportunityId));

    selectedOpportunities.clear();

    saveOpportunitiesToStorage();
    saveTasksToStorage();
    renderOpportunities();
    renderTasks();
    updateTaskOpportunityFilters();
    updateDashboard();
    updateBulkActionsUI('opportunities');

    showUndoToast(`${deletedOpportunities.length} opportunities deleted`);
}

function bulkDeleteTasks() {
    if (selectedTasks.size === 0) return;

    if (!confirm(`Delete ${selectedTasks.size} tasks?`)) {
        return;
    }

    const deletedTasks = [];

    selectedTasks.forEach(id => {
        const task = tasks.find(t => t.id === id);
        if (task) {
            deletedTasks.push(task);
        }
    });

    // Add to undo stack
    addToUndoStack({
        type: 'bulk_delete_tasks',
        data: { tasks: deletedTasks }
    });

    // Delete tasks
    tasks = tasks.filter(task => !selectedTasks.has(task.id));

    selectedTasks.clear();

    saveTasksToStorage();
    renderTasks();
    updateDashboard();
    updateBulkActionsUI('tasks');

    showUndoToast(`${deletedTasks.length} tasks deleted`);
}

function bulkUpdateOpportunityStatus(newStatus) {
    if (selectedOpportunities.size === 0) return;

    selectedOpportunities.forEach(id => {
        const opp = opportunities.find(o => o.id === id);
        if (opp) {
            opp.status = newStatus;
        }
    });

    selectedOpportunities.clear();

    saveOpportunitiesToStorage();
    renderOpportunities();
    updateDashboard();
    updateBulkActionsUI('opportunities');

    showSuccess(`Updated ${selectedOpportunities.size} opportunities to ${newStatus}`);
}

function bulkUpdateTaskStatus(newStatus) {
    if (selectedTasks.size === 0) return;

    const count = selectedTasks.size;

    selectedTasks.forEach(id => {
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.status = newStatus;
        }
    });

    selectedTasks.clear();

    saveTasksToStorage();
    renderTasks();
    updateDashboard();
    updateBulkActionsUI('tasks');

    showSuccess(`Updated ${count} tasks to ${newStatus}`);
}

// ===========================
// Business Logic Functions
// ===========================

function calculateExpectedRevenue(dealValue, probability) {
    return dealValue * (probability / 100);
}

function calculateBANT(budget, authority, need, timeline) {
    const total = budget + authority + need + timeline;
    const percent = (total / MAX_BANT_SCORE) * 100;
    let summary = 'Cold';
    
    if (percent >= BANT_THRESHOLDS.HOT) {
        summary = 'Hot';
    } else if (percent >= BANT_THRESHOLDS.WARM) {
        summary = 'Warm';
    }
    
    return {
        total: total,
        percent: percent,
        summary: summary
    };
}

// ===========================
// Tab Navigation
// ===========================

function initializeEventListeners() {
    // Tab navigation
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });
    
    // Opportunity modal controls
    document.getElementById('add-opportunity-btn').addEventListener('click', openAddOpportunityModal);
    document.getElementById('close-opportunity-modal').addEventListener('click', closeOpportunityModal);
    document.getElementById('cancel-opportunity-btn').addEventListener('click', closeOpportunityModal);
    document.getElementById('opportunity-form').addEventListener('submit', saveOpportunity);
    
    // Task modal controls
    document.getElementById('add-task-btn').addEventListener('click', openAddTaskModal);
    document.getElementById('close-task-modal').addEventListener('click', closeTaskModal);
    document.getElementById('cancel-task-btn').addEventListener('click', closeTaskModal);
    document.getElementById('task-form').addEventListener('submit', saveTask);
    
    // Auto-calculation for opportunities
    document.getElementById('opp-deal-value').addEventListener('input', updateOpportunityCalculations);
    document.getElementById('opp-probability').addEventListener('input', updateOpportunityCalculations);
    document.getElementById('opp-bant-budget').addEventListener('input', updateBANTCalculations);
    document.getElementById('opp-bant-authority').addEventListener('input', updateBANTCalculations);
    document.getElementById('opp-bant-need').addEventListener('input', updateBANTCalculations);
    document.getElementById('opp-bant-timeline').addEventListener('input', updateBANTCalculations);
    
    // Search and filter with debouncing
    const debouncedRenderOpportunities = debounce(renderOpportunities, 300);
    const debouncedRenderTasks = debounce(renderTasks, 300);
    
    document.getElementById('opp-search').addEventListener('input', debouncedRenderOpportunities);
    document.getElementById('opp-filter-stage').addEventListener('change', renderOpportunities);
    document.getElementById('opp-filter-status').addEventListener('change', renderOpportunities);
    document.getElementById('task-search').addEventListener('input', debouncedRenderTasks);
    document.getElementById('task-filter-status').addEventListener('change', renderTasks);
    document.getElementById('task-filter-opportunity').addEventListener('change', renderTasks);
    
    // Close modal when clicking on backdrop only
    window.addEventListener('click', function(event) {
        const oppModal = document.getElementById('opportunity-modal');
        const taskModal = document.getElementById('task-modal');

        if (event.target === oppModal) {
            closeOpportunityModal();
        }
        if (event.target === taskModal) {
            closeTaskModal();
        }
    });

    // Keyboard navigation
    document.addEventListener('keydown', function(event) {
        // Escape key closes modals
        if (event.key === 'Escape') {
            const oppModal = document.getElementById('opportunity-modal');
            const taskModal = document.getElementById('task-modal');

            if (oppModal.classList.contains('active')) {
                closeOpportunityModal();
            }
            if (taskModal.classList.contains('active')) {
                closeTaskModal();
            }
        }

        // Ctrl/Cmd + E for export
        if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
            event.preventDefault();
            exportToJSON();
        }

        // Ctrl/Cmd + I for import
        if ((event.ctrlKey || event.metaKey) && event.key === 'i') {
            event.preventDefault();
            importFromJSON();
        }
    });
}

function switchTab(tabName) {
    // Update tab buttons
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Update tab content
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
        content.classList.remove('active');
    });
    
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // Refresh data based on tab
    if (tabName === 'dashboard') {
        updateDashboard();
    } else if (tabName === 'calendar') {
        renderCalendar();
    } else if (tabName === 'kanban') {
        renderKanbanBoard();
    }
}

// ===========================
// Opportunity Modal Functions
// ===========================

function openAddOpportunityModal() {
    currentEditingOpportunity = null;
    document.getElementById('opportunity-modal-title').textContent = 'Add Opportunity';
    document.getElementById('opportunity-form').reset();
    updateOpportunityCalculations();
    updateBANTCalculations();
    document.getElementById('opportunity-modal').classList.add('active');

    // Focus first input
    setTimeout(() => {
        document.getElementById('opp-name').focus();
    }, 100);
}

function openEditOpportunityModal(id) {
    const opportunity = opportunities.find(opp => opp.id === id);
    if (!opportunity) return;
    
    currentEditingOpportunity = id;
    document.getElementById('opportunity-modal-title').textContent = 'Edit Opportunity';
    
    // Populate form
    document.getElementById('opp-name').value = opportunity.name || '';
    document.getElementById('opp-client').value = opportunity.client || '';
    document.getElementById('opp-industry').value = opportunity.industry || 'Healthcare';
    document.getElementById('opp-sales-owner').value = opportunity.salesOwner || '';
    document.getElementById('opp-presales-owner').value = opportunity.preSalesOwner || '';
    document.getElementById('opp-ba').value = opportunity.ba || '';
    document.getElementById('opp-tech-type').value = opportunity.techType || 'AI';
    document.getElementById('opp-source').value = opportunity.source || 'RFP';
    document.getElementById('opp-date-identified').value = opportunity.dateIdentified || '';
    document.getElementById('opp-expected-close').value = opportunity.expectedClose || '';
    document.getElementById('opp-stage').value = opportunity.stage || 'Lead';
    document.getElementById('opp-status').value = opportunity.status || 'Open';
    document.getElementById('opp-deal-value').value = opportunity.dealValue || 0;
    document.getElementById('opp-probability').value = opportunity.probability || 0;
    document.getElementById('opp-competition').value = opportunity.competition || '';
    document.getElementById('opp-contact-name').value = opportunity.contactName || '';
    document.getElementById('opp-contact-email').value = opportunity.contactEmail || '';
    document.getElementById('opp-bant-budget').value = opportunity.bant?.budget || 1;
    document.getElementById('opp-bant-authority').value = opportunity.bant?.authority || 1;
    document.getElementById('opp-bant-need').value = opportunity.bant?.need || 1;
    document.getElementById('opp-bant-timeline').value = opportunity.bant?.timeline || 1;
    
    updateOpportunityCalculations();
    updateBANTCalculations();

    document.getElementById('opportunity-modal').classList.add('active');

    // Focus first input
    setTimeout(() => {
        document.getElementById('opp-name').focus();
    }, 100);
}

function closeOpportunityModal() {
    document.getElementById('opportunity-modal').classList.remove('active');
    currentEditingOpportunity = null;
}

function updateOpportunityCalculations() {
    const dealValue = parseFloat(document.getElementById('opp-deal-value').value) || 0;
    const probability = parseFloat(document.getElementById('opp-probability').value) || 0;
    const expectedRevenue = calculateExpectedRevenue(dealValue, probability);
    
    document.getElementById('opp-expected-revenue').value = `$${formatCurrency(expectedRevenue)}`;
}

function updateBANTCalculations() {
    const budget = parseInt(document.getElementById('opp-bant-budget').value) || 1;
    const authority = parseInt(document.getElementById('opp-bant-authority').value) || 1;
    const need = parseInt(document.getElementById('opp-bant-need').value) || 1;
    const timeline = parseInt(document.getElementById('opp-bant-timeline').value) || 1;
    
    const bant = calculateBANT(budget, authority, need, timeline);
    
    document.getElementById('opp-bant-total').value = bant.total;
    document.getElementById('opp-bant-percent').value = `${bant.percent}%`;
    document.getElementById('opp-bant-summary').value = bant.summary;
}

function saveOpportunity(event) {
    event.preventDefault();
    
    const dealValue = parseFloat(document.getElementById('opp-deal-value').value) || 0;
    const probability = parseFloat(document.getElementById('opp-probability').value) || 0;
    const budget = parseInt(document.getElementById('opp-bant-budget').value) || 1;
    const authority = parseInt(document.getElementById('opp-bant-authority').value) || 1;
    const need = parseInt(document.getElementById('opp-bant-need').value) || 1;
    const timeline = parseInt(document.getElementById('opp-bant-timeline').value) || 1;
    
    const bant = calculateBANT(budget, authority, need, timeline);
    const expectedRevenue = calculateExpectedRevenue(dealValue, probability);
    
    const opportunityData = {
        id: currentEditingOpportunity || generateOpportunityID(),
        name: document.getElementById('opp-name').value,
        client: document.getElementById('opp-client').value,
        industry: document.getElementById('opp-industry').value,
        salesOwner: document.getElementById('opp-sales-owner').value,
        preSalesOwner: document.getElementById('opp-presales-owner').value,
        ba: document.getElementById('opp-ba').value,
        techType: document.getElementById('opp-tech-type').value,
        source: document.getElementById('opp-source').value,
        dateIdentified: document.getElementById('opp-date-identified').value,
        expectedClose: document.getElementById('opp-expected-close').value,
        stage: document.getElementById('opp-stage').value,
        status: document.getElementById('opp-status').value,
        dealValue: dealValue,
        probability: probability,
        expectedRevenue: expectedRevenue,
        competition: document.getElementById('opp-competition').value,
        contactName: document.getElementById('opp-contact-name').value,
        contactEmail: document.getElementById('opp-contact-email').value,
        bant: {
            budget: budget,
            authority: authority,
            need: need,
            timeline: timeline
        },
        bantTotal: bant.total,
        bantPercent: bant.percent,
        bantSummary: bant.summary
    };
    
    if (currentEditingOpportunity) {
        // Update existing
        const index = opportunities.findIndex(opp => opp.id === currentEditingOpportunity);
        if (index !== -1) {
            opportunities[index] = opportunityData;
        }
    } else {
        // Add new
        opportunities.push(opportunityData);
    }
    
    saveOpportunitiesToStorage();
    renderOpportunities();
    updateTaskOpportunityFilters();
    updateDashboard();
    closeOpportunityModal();
}

function deleteOpportunity(id) {
    if (!confirm('Are you sure you want to delete this opportunity? All associated tasks will also be deleted.')) {
        return;
    }

    // Find opportunity and associated tasks
    const opportunity = opportunities.find(opp => opp.id === id);
    const associatedTasks = tasks.filter(task => task.opportunityId === id);

    // Add to undo stack
    addToUndoStack({
        type: 'delete_opportunity',
        data: {
            opportunity: opportunity,
            tasks: associatedTasks
        }
    });

    // Delete opportunity
    opportunities = opportunities.filter(opp => opp.id !== id);
    saveOpportunitiesToStorage();

    // Delete associated tasks
    tasks = tasks.filter(task => task.opportunityId !== id);
    saveTasksToStorage();

    renderOpportunities();
    renderTasks();
    updateTaskOpportunityFilters();
    updateDashboard();

    // Show undo toast
    showUndoToast('Opportunity deleted');
}

// ===========================
// Task Modal Functions
// ===========================

function openAddTaskModal() {
    currentEditingTask = null;
    document.getElementById('task-modal-title').textContent = 'Add Task';
    document.getElementById('task-form').reset();
    populateTaskOpportunityDropdown();
    document.getElementById('task-modal').classList.add('active');

    // Focus first input
    setTimeout(() => {
        document.getElementById('task-opportunity').focus();
    }, 100);
}

function openEditTaskModal(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    currentEditingTask = id;
    document.getElementById('task-modal-title').textContent = 'Edit Task';
    
    populateTaskOpportunityDropdown();
    
    // Populate form
    document.getElementById('task-opportunity').value = task.opportunityId || '';
    document.getElementById('task-name').value = task.taskName || '';
    document.getElementById('task-assigned-to').value = task.assignedTo || '';
    document.getElementById('task-role').value = task.role || 'Sales';
    document.getElementById('task-type').value = task.taskType || 'Document';
    document.getElementById('task-start-date').value = task.startDate || '';
    document.getElementById('task-due-date').value = task.dueDate || '';
    document.getElementById('task-status').value = task.status || 'Not Started';
    document.getElementById('task-remarks').value = task.remarks || '';

    document.getElementById('task-modal').classList.add('active');

    // Focus first input
    setTimeout(() => {
        document.getElementById('task-opportunity').focus();
    }, 100);
}

function closeTaskModal() {
    document.getElementById('task-modal').classList.remove('active');
    currentEditingTask = null;
}

function populateTaskOpportunityDropdown() {
    const select = document.getElementById('task-opportunity');
    select.innerHTML = '<option value="">Select Opportunity</option>';
    
    opportunities.forEach(opp => {
        const option = document.createElement('option');
        option.value = opp.id;
        option.textContent = `${opp.id} - ${opp.name}`;
        select.appendChild(option);
    });
}

function saveTask(event) {
    event.preventDefault();
    
    const taskData = {
        id: currentEditingTask || generateTaskID(),
        opportunityId: document.getElementById('task-opportunity').value,
        taskName: document.getElementById('task-name').value,
        assignedTo: document.getElementById('task-assigned-to').value,
        role: document.getElementById('task-role').value,
        taskType: document.getElementById('task-type').value,
        startDate: document.getElementById('task-start-date').value,
        dueDate: document.getElementById('task-due-date').value,
        status: document.getElementById('task-status').value,
        remarks: document.getElementById('task-remarks').value
    };
    
    if (currentEditingTask) {
        // Update existing
        const index = tasks.findIndex(t => t.id === currentEditingTask);
        if (index !== -1) {
            tasks[index] = taskData;
        }
    } else {
        // Add new
        tasks.push(taskData);
    }
    
    saveTasksToStorage();
    renderTasks();
    updateDashboard();
    closeTaskModal();
}

function deleteTask(id) {
    if (!confirm('Are you sure you want to delete this task?')) {
        return;
    }

    // Find task
    const task = tasks.find(t => t.id === id);

    // Add to undo stack
    addToUndoStack({
        type: 'delete_task',
        data: { task: task }
    });

    tasks = tasks.filter(t => t.id !== id);
    saveTasksToStorage();
    renderTasks();
    updateDashboard();

    // Show undo toast
    showUndoToast('Task deleted');
}

// ===========================
// Render Functions
// ===========================

function renderOpportunities() {
    const tbody = document.getElementById('opportunities-tbody');
    const searchTerm = document.getElementById('opp-search').value.toLowerCase();
    const filterStage = document.getElementById('opp-filter-stage').value;
    const filterStatus = document.getElementById('opp-filter-status').value;
    
    // Filter opportunities
    let filteredOpportunities = opportunities.filter(opp => {
        const matchesSearch = !searchTerm || 
            opp.name.toLowerCase().includes(searchTerm) ||
            opp.client.toLowerCase().includes(searchTerm) ||
            opp.id.toLowerCase().includes(searchTerm);
        
        const matchesStage = !filterStage || opp.stage === filterStage;
        const matchesStatus = !filterStatus || opp.status === filterStatus;
        
        return matchesSearch && matchesStage && matchesStatus;
    });
    
    if (filteredOpportunities.length === 0) {
        tbody.innerHTML = '<tr><td colspan="13" class="empty-state"><p>No opportunities found. Click "Add Opportunity" to create one.</p></td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    filteredOpportunities.forEach(opp => {
        const row = document.createElement('tr');
        const isChecked = selectedOpportunities.has(opp.id) ? 'checked' : '';
        row.innerHTML = `
            <td><input type="checkbox" ${isChecked} data-id="${escapeHtml(opp.id)}" class="row-checkbox" onchange="toggleOpportunitySelection('${escapeHtml(opp.id)}')"></td>
            <td><strong>${escapeHtml(opp.id)}</strong></td>
            <td>${escapeHtml(opp.name)}</td>
            <td>${escapeHtml(opp.client)}</td>
            <td>${escapeHtml(opp.industry)}</td>
            <td>${escapeHtml(opp.stage)}</td>
            <td><span class="badge badge-${opp.status.toLowerCase().replace(' ', '-')}">${escapeHtml(opp.status)}</span></td>
            <td>$${opp.dealValue.toLocaleString()}</td>
            <td>${opp.probability}%</td>
            <td>$${formatCurrency(opp.expectedRevenue)}</td>
            <td>${opp.bantPercent.toFixed(0)}%</td>
            <td><span class="badge badge-${opp.bantSummary.toLowerCase()}">${escapeHtml(opp.bantSummary)}</span></td>
            <td>
                <div class="actions-cell">
                    <button class="btn btn-edit" data-id="${escapeHtml(opp.id)}">Edit</button>
                    <button class="btn btn-delete" data-id="${escapeHtml(opp.id)}">Delete</button>
                </div>
            </td>
        `;
        
        // Add event listeners to buttons
        row.querySelector('.btn-edit').addEventListener('click', function() {
            openEditOpportunityModal(this.getAttribute('data-id'));
        });
        row.querySelector('.btn-delete').addEventListener('click', function() {
            deleteOpportunity(this.getAttribute('data-id'));
        });
        
        tbody.appendChild(row);
    });
}

function renderTasks() {
    const tbody = document.getElementById('tasks-tbody');
    const searchTerm = document.getElementById('task-search').value.toLowerCase();
    const filterStatus = document.getElementById('task-filter-status').value;
    const filterOpportunity = document.getElementById('task-filter-opportunity').value;
    
    // Filter tasks
    let filteredTasks = tasks.filter(task => {
        const matchesSearch = !searchTerm || 
            task.taskName.toLowerCase().includes(searchTerm) ||
            (task.assignedTo && task.assignedTo.toLowerCase().includes(searchTerm)) ||
            task.id.toLowerCase().includes(searchTerm);
        
        const matchesStatus = !filterStatus || task.status === filterStatus;
        const matchesOpportunity = !filterOpportunity || task.opportunityId === filterOpportunity;
        
        return matchesSearch && matchesStatus && matchesOpportunity;
    });
    
    if (filteredTasks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="empty-state"><p>No tasks found. Click "Add Task" to create one.</p></td></tr>';
        return;
    }

    tbody.innerHTML = '';
    filteredTasks.forEach(task => {
        const opportunity = opportunities.find(opp => opp.id === task.opportunityId);
        const opportunityName = opportunity ? opportunity.name : 'N/A';
        const isChecked = selectedTasks.has(task.id) ? 'checked' : '';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="checkbox" ${isChecked} data-id="${escapeHtml(task.id)}" class="row-checkbox" onchange="toggleTaskSelection('${escapeHtml(task.id)}')"></td>
            <td><strong>${escapeHtml(task.id)}</strong></td>
            <td>${escapeHtml(opportunityName)}</td>
            <td>${escapeHtml(task.taskName)}</td>
            <td>${escapeHtml(task.assignedTo || '')}</td>
            <td>${escapeHtml(task.role)}</td>
            <td>${escapeHtml(task.taskType)}</td>
            <td>${escapeHtml(task.startDate || 'N/A')}</td>
            <td>${escapeHtml(task.dueDate || 'N/A')}</td>
            <td>${escapeHtml(task.status)}</td>
            <td>
                <div class="actions-cell">
                    <button class="btn btn-edit" data-id="${escapeHtml(task.id)}">Edit</button>
                    <button class="btn btn-delete" data-id="${escapeHtml(task.id)}">Delete</button>
                </div>
            </td>
        `;
        
        // Add event listeners to buttons
        row.querySelector('.btn-edit').addEventListener('click', function() {
            openEditTaskModal(this.getAttribute('data-id'));
        });
        row.querySelector('.btn-delete').addEventListener('click', function() {
            deleteTask(this.getAttribute('data-id'));
        });
        
        tbody.appendChild(row);
    });
}

function updateTaskOpportunityFilters() {
    const select = document.getElementById('task-filter-opportunity');
    const currentValue = select.value;
    
    select.innerHTML = '<option value="">All Opportunities</option>';
    
    opportunities.forEach(opp => {
        const option = document.createElement('option');
        option.value = opp.id;
        option.textContent = `${opp.id} - ${opp.name}`;
        select.appendChild(option);
    });
    
    // Restore previous selection if still valid
    if (currentValue && opportunities.find(opp => opp.id === currentValue)) {
        select.value = currentValue;
    }
}

// ===========================
// Dashboard Functions
// ===========================

function updateDashboard() {
    // Opportunities Overview
    const totalOpps = opportunities.length;
    const openOpps = opportunities.filter(opp => opp.status === 'Open').length;
    const wonOpps = opportunities.filter(opp => opp.status === 'Won').length;
    const lostOpps = opportunities.filter(opp => opp.status === 'Lost').length;
    
    document.getElementById('stat-total-opps').textContent = totalOpps;
    document.getElementById('stat-open-opps').textContent = openOpps;
    document.getElementById('stat-won-opps').textContent = wonOpps;
    document.getElementById('stat-lost-opps').textContent = lostOpps;
    
    // Revenue Metrics
    const totalPipelineValue = opportunities.reduce((sum, opp) => sum + opp.dealValue, 0);
    const totalExpectedRevenue = opportunities.reduce((sum, opp) => sum + opp.expectedRevenue, 0);
    const avgDealSize = totalOpps > 0 ? totalPipelineValue / totalOpps : 0;
    const avgProbability = totalOpps > 0 ? opportunities.reduce((sum, opp) => sum + opp.probability, 0) / totalOpps : 0;
    
    document.getElementById('stat-pipeline-value').textContent = `$${totalPipelineValue.toLocaleString()}`;
    document.getElementById('stat-expected-revenue').textContent = `$${formatCurrency(totalExpectedRevenue)}`;
    document.getElementById('stat-avg-deal').textContent = `$${formatCurrency(avgDealSize)}`;
    document.getElementById('stat-avg-probability').textContent = `${avgProbability.toFixed(1)}%`;
    
    // BANT Analysis
    const avgBANT = totalOpps > 0 ? opportunities.reduce((sum, opp) => sum + opp.bantPercent, 0) / totalOpps : 0;
    const hotLeads = opportunities.filter(opp => opp.bantSummary === 'Hot').length;
    const warmLeads = opportunities.filter(opp => opp.bantSummary === 'Warm').length;
    const coldLeads = opportunities.filter(opp => opp.bantSummary === 'Cold').length;
    
    document.getElementById('stat-avg-bant').textContent = `${avgBANT.toFixed(1)}%`;
    document.getElementById('stat-hot-leads').textContent = hotLeads;
    document.getElementById('stat-warm-leads').textContent = warmLeads;
    document.getElementById('stat-cold-leads').textContent = coldLeads;
    
    // Tasks Overview
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.status === 'Completed').length;
    const progressTasks = tasks.filter(task => task.status === 'In Progress').length;
    const delayedTasks = tasks.filter(task => task.status === 'Delayed').length;
    
    document.getElementById('stat-total-tasks').textContent = totalTasks;
    document.getElementById('stat-completed-tasks').textContent = completedTasks;
    document.getElementById('stat-progress-tasks').textContent = progressTasks;
    document.getElementById('stat-delayed-tasks').textContent = delayedTasks;
}

// ===========================
// Calendar View Functions
// ===========================

function initializeCalendar() {
    document.getElementById('calendar-prev-month').addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });
    
    document.getElementById('calendar-next-month').addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });
    
    document.getElementById('calendar-today').addEventListener('click', () => {
        currentCalendarDate = new Date();
        renderCalendar();
    });
}

function renderCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // Update month/year display
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('calendar-month-year').textContent = `${monthNames[month]} ${year}`;
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    // Get previous month's last days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    
    // Build calendar grid
    const calendarGrid = document.getElementById('calendar-grid');
    calendarGrid.innerHTML = '';
    
    // Add day headers
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        calendarGrid.appendChild(header);
    });
    
    // Add previous month's trailing days
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
        const dayNum = prevMonthLastDay - i;
        const dayCell = createCalendarDay(dayNum, year, month - 1, true);
        calendarGrid.appendChild(dayCell);
    }
    
    // Add current month's days
    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = createCalendarDay(day, year, month, false);
        calendarGrid.appendChild(dayCell);
    }
    
    // Add next month's leading days
    const totalCells = calendarGrid.children.length - 7; // Subtract headers
    const remainingCells = 42 - totalCells; // 6 rows * 7 days
    for (let day = 1; day <= remainingCells; day++) {
        const dayCell = createCalendarDay(day, year, month + 1, true);
        calendarGrid.appendChild(dayCell);
    }
    
    // If a date was selected, show its tasks
    if (selectedCalendarDate) {
        showTasksForDate(selectedCalendarDate);
    }
}

function createCalendarDay(day, year, month, isOtherMonth) {
    const dayCell = document.createElement('div');
    dayCell.className = 'calendar-day';
    
    if (isOtherMonth) {
        dayCell.classList.add('other-month');
    }
    
    const date = new Date(year, month, day);
    const dateStr = formatDate(date);
    
    // Check if it's today
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
        dayCell.classList.add('today');
    }
    
    // Check if it's selected
    if (selectedCalendarDate && date.toDateString() === selectedCalendarDate.toDateString()) {
        dayCell.classList.add('selected');
    }
    
    // Day number
    const dayNumber = document.createElement('div');
    dayNumber.className = 'calendar-day-number';
    dayNumber.textContent = day;
    dayCell.appendChild(dayNumber);
    
    // Get tasks for this date
    const dayTasks = tasks.filter(task => {
        if (!task.dueDate) return false;
        const taskDate = new Date(task.dueDate);
        return taskDate.toDateString() === date.toDateString();
    });
    
    // Add task indicators
    dayTasks.slice(0, 3).forEach(task => {
        const indicator = document.createElement('div');
        indicator.className = `calendar-task-indicator status-${task.status.toLowerCase().replace(' ', '-')}`;
        indicator.textContent = task.taskName;
        indicator.title = task.taskName;
        dayCell.appendChild(indicator);
    });
    
    // Show "+X more" if there are more tasks
    if (dayTasks.length > 3) {
        const moreIndicator = document.createElement('div');
        moreIndicator.className = 'calendar-task-indicator';
        moreIndicator.textContent = `+${dayTasks.length - 3} more`;
        dayCell.appendChild(moreIndicator);
    }
    
    // Click handler
    dayCell.addEventListener('click', () => {
        selectedCalendarDate = date;
        renderCalendar();
        showTasksForDate(date);
    });
    
    return dayCell;
}

function showTasksForDate(date) {
    const dateStr = date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    document.getElementById('selected-date').textContent = dateStr;
    
    const dayTasks = tasks.filter(task => {
        if (!task.dueDate) return false;
        const taskDate = new Date(task.dueDate);
        return taskDate.toDateString() === date.toDateString();
    });
    
    const tasksContainer = document.getElementById('selected-date-tasks');
    
    if (dayTasks.length === 0) {
        tasksContainer.innerHTML = '<p style="color: #666;">No tasks due on this date.</p>';
        return;
    }
    
    tasksContainer.innerHTML = '';
    
    dayTasks.forEach(task => {
        const opportunity = opportunities.find(opp => opp.id === task.opportunityId);
        
        const taskItem = document.createElement('div');
        taskItem.className = `calendar-task-item status-${task.status.toLowerCase().replace(' ', '-')}`;
        
        taskItem.innerHTML = `
            <h4>${escapeHtml(task.taskName)}</h4>
            <p><strong>Opportunity:</strong> ${escapeHtml(opportunity ? opportunity.name : 'N/A')}</p>
            <p><strong>Assigned To:</strong> ${escapeHtml(task.assignedTo || 'Unassigned')}</p>
            <p><strong>Role:</strong> ${escapeHtml(task.role)}</p>
            <p><strong>Type:</strong> ${escapeHtml(task.taskType)}</p>
            <p><strong>Status:</strong> ${escapeHtml(task.status)}</p>
            ${task.remarks ? `<p><strong>Remarks:</strong> ${escapeHtml(task.remarks)}</p>` : ''}
        `;
        
        tasksContainer.appendChild(taskItem);
    });
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ===========================
// Kanban Board Functions
// ===========================

function initializeKanban() {
    const kanbanCards = document.querySelectorAll('.kanban-cards');
    
    kanbanCards.forEach(column => {
        column.addEventListener('dragover', handleDragOver);
        column.addEventListener('drop', handleDrop);
        column.addEventListener('dragleave', handleDragLeave);
    });
}

function renderKanbanBoard() {
    const stages = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed'];
    
    stages.forEach(stage => {
        const columnId = `kanban-${stage.toLowerCase()}`;
        const column = document.getElementById(columnId);
        const countId = `count-${stage.toLowerCase()}`;
        const valueId = `value-${stage.toLowerCase()}`;
        
        if (!column) return;
        
        // Filter opportunities by stage
        const stageOpportunities = opportunities.filter(opp => opp.stage === stage);
        
        // Calculate total value for this stage
        const totalValue = stageOpportunities.reduce((sum, opp) => sum + opp.dealValue, 0);
        
        // Update count and value
        document.getElementById(countId).textContent = stageOpportunities.length;
        const valueElement = document.getElementById(valueId);
        if (valueElement) {
            valueElement.textContent = `${totalValue.toLocaleString()}`;
        }
        
        // Clear and render cards
        column.innerHTML = '';
        
        stageOpportunities.forEach(opp => {
            const card = createKanbanCard(opp);
            column.appendChild(card);
        });
        
        // Add empty state if no cards
        if (stageOpportunities.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.style.cssText = 'text-align: center; color: #999; padding: 2rem; font-size: 0.9rem;';
            emptyState.textContent = 'No opportunities';
            column.appendChild(emptyState);
        }
    });
}

function createKanbanCard(opportunity) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.draggable = true;
    card.dataset.opportunityId = opportunity.id;
    
    // Drag event listeners
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
    
    // Status class
    const statusClass = `status-${opportunity.status.toLowerCase().replace(' ', '-')}`;
    const bantClass = `bant-${opportunity.bantSummary.toLowerCase()}`;
    
    card.innerHTML = `
        <div class="kanban-card-header">
            <div class="kanban-card-id">${escapeHtml(opportunity.id)}</div>
            <span class="kanban-card-status ${statusClass}">${escapeHtml(opportunity.status)}</span>
        </div>
        <div class="kanban-card-title">${escapeHtml(opportunity.name)}</div>
        <div class="kanban-card-client">${escapeHtml(opportunity.client)}</div>
        <div class="kanban-card-details">
            <div class="kanban-card-row">
                <span class="kanban-card-label">Deal Value:</span>
                <span class="kanban-card-value">${opportunity.dealValue.toLocaleString()}</span>
            </div>
            <div class="kanban-card-row">
                <span class="kanban-card-label">Probability:</span>
                <span class="kanban-card-value">${opportunity.probability}%</span>
            </div>
            <div class="kanban-card-row">
                <span class="kanban-card-label">Expected Revenue:</span>
                <span class="kanban-card-value">${opportunity.expectedRevenue.toLocaleString()}</span>
            </div>
        </div>
        <div class="kanban-card-footer">
            <span class="kanban-bant-badge ${bantClass}">${escapeHtml(opportunity.bantSummary)} (${opportunity.bantPercent.toFixed(0)}%)</span>
            <span style="color: #666; font-size: 0.8rem;">${escapeHtml(opportunity.industry)}</span>
        </div>
    `;
    
    // Double-click to edit
    card.addEventListener('dblclick', () => {
        openEditOpportunityModal(opportunity.id);
    });
    
    return card;
}

function handleDragStart(e) {
    draggedCard = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    this.classList.add('drag-over');
    return false;
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    this.classList.remove('drag-over');
    
    if (draggedCard) {
        const opportunityId = draggedCard.dataset.opportunityId;
        const newStage = this.parentElement.dataset.stage;
        
        // Update opportunity stage
        const opportunity = opportunities.find(opp => opp.id === opportunityId);
        if (opportunity) {
            opportunity.stage = newStage;
            saveOpportunitiesToStorage();
            renderKanbanBoard();
            renderOpportunities();
            updateDashboard();
        }
    }
    
    return false;
}