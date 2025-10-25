// ===========================
// Constants
// ===========================

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
});

// ===========================
// Local Storage Functions
// ===========================

function loadDataFromStorage() {
    try {
        const storedOpportunities = localStorage.getItem('opportunities');
        const storedTasks = localStorage.getItem('tasks');
        
        opportunities = storedOpportunities ? JSON.parse(storedOpportunities) : [];
        tasks = storedTasks ? JSON.parse(storedTasks) : [];
    } catch (error) {
        console.error('Error loading data from storage:', error);
        opportunities = [];
        tasks = [];
    }
}

function saveOpportunitiesToStorage() {
    try {
        localStorage.setItem('opportunities', JSON.stringify(opportunities));
    } catch (error) {
        console.error('Error saving opportunities:', error);
        alert('Unable to save data. Storage may be full.');
    }
}

function saveTasksToStorage() {
    try {
        localStorage.setItem('tasks', JSON.stringify(tasks));
    } catch (error) {
        console.error('Error saving tasks:', error);
        alert('Unable to save data. Storage may be full.');
    }
}

// ===========================
// ID Generators
// ===========================

function generateOpportunityID() {
    const year = new Date().getFullYear();
    const timestamp = String(Date.now()).slice(-3);
    return `OP-${year}-${timestamp}`;
}

function generateTaskID() {
    const timestamp = String(Date.now()).slice(-4);
    return `TSK-${timestamp}`;
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
    
    tasks = tasks.filter(task => task.id !== id);
    saveTasksToStorage();
    renderTasks();
    updateDashboard();
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
        tbody.innerHTML = '<tr><td colspan="12" class="empty-state"><p>No opportunities found. Click "Add Opportunity" to create one.</p></td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    filteredOpportunities.forEach(opp => {
        const row = document.createElement('tr');
        row.innerHTML = `
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
        tbody.innerHTML = '<tr><td colspan="10" class="empty-state"><p>No tasks found. Click "Add Task" to create one.</p></td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    filteredTasks.forEach(task => {
        const opportunity = opportunities.find(opp => opp.id === task.opportunityId);
        const opportunityName = opportunity ? opportunity.name : 'N/A';
        
        const row = document.createElement('tr');
        row.innerHTML = `
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