// Calendar functionality with backend integration
const API_ENDPOINT = 'https://j65hehh767.execute-api.us-east-2.amazonaws.com/dev';

let currentDate = new Date();
let selectedDate = null;
let meetingSlots = new Set();
let userAvailability = new Set();
let partnerAvailability = new Set();
let isAdmin = false;

async function initCalendar() {
    try {
        await checkAdminStatus();
        
        // Check if user has a match (skip for admins)
        if (!isAdmin) {
            const hasMatch = await checkUserHasMatch();
            if (!hasMatch) {
                showNoMatchMessage();
                return;
            }
        }
        
        await loadMeetingSlots();
        if (!isAdmin) {
            await loadAvailability();
        }
        renderCalendar();
        updateUIForRole();
    } catch (error) {
        console.error('Error initializing calendar:', error);
    }
}

async function checkUserHasMatch() {
    try {
        const session = await window.Auth.currentSession();
        const token = session.getIdToken().getJwtToken();
        
        const response = await fetch(`${API_ENDPOINT}/matches`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) return false;
        
        const matches = await response.json();
        return matches && matches.length > 0;
    } catch (error) {
        console.error('Error checking matches:', error);
        return false;
    }
}

function showNoMatchMessage() {
    const calendarContainer = document.querySelector('.calendar-container');
    calendarContainer.innerHTML = `
        <h1>Visit Calendar</h1>
        <div style="text-align: center; padding: 3rem; background: #f8faff; border-radius: 0.5rem; margin-top: 2rem;">
            <div style="font-size: 3rem; margin-bottom: 1rem; color: #012572;">📅</div>
            <h2 style="color: #012572; margin-bottom: 1rem;">No Match Yet</h2>
            <p style="color: #666; font-size: 1.1rem; max-width: 500px; margin: 0 auto;">
                The calendar feature is available once you've been matched with a partner. 
                Please complete your interest form and wait for an admin to create matches.
            </p>
            <button onclick="window.location.href='home.html'" style="
                margin-top: 2rem;
                padding: 0.75rem 1.5rem;
                background-color: #012572;
                color: white;
                border: none;
                border-radius: 0.5rem;
                cursor: pointer;
                font-size: 1rem;
                font-family: 'Open Sans', sans-serif;
            ">Return to Home</button>
        </div>
    `;
}

async function checkAdminStatus() {
    try {
        const session = await window.Auth.currentSession();
        const token = session.getIdToken().getJwtToken();
        
        // Try to access an admin-only endpoint to check status
        const response = await fetch(`${API_ENDPOINT}/matches/all`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        // If we can access /matches/all, user is admin
        isAdmin = response.ok;
    } catch (error) {
        console.error('Error checking admin status:', error);
        isAdmin = false;
    }
}

function updateUIForRole() {
    const modalBody = document.querySelector('.modal-body');
    if (isAdmin) {
        document.querySelector('h1').textContent = 'Visit Calendar - Admin';
        modalBody.innerHTML = `
            <p style="margin-bottom: 1rem; color: #666;">Manage meeting slot for this date:</p>
            <div class="availability-option">
                <input type="checkbox" id="slotCheckbox">
                <label for="slotCheckbox">This date is available for visits</label>
            </div>
        `;
    }
}

async function loadMeetingSlots() {
    try {
        const session = await window.Auth.currentSession();
        const token = session.getIdToken().getJwtToken();
        
        const response = await fetch(`${API_ENDPOINT}/calendar/slots`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) throw new Error('Failed to load meeting slots');
        
        const slots = await response.json();
        meetingSlots = new Set(slots.map(slot => slot.date));
    } catch (error) {
        console.error('Error loading meeting slots:', error);
    }
}

async function loadAvailability() {
    try {
        const session = await window.Auth.currentSession();
        const token = session.getIdToken().getJwtToken();
        
        const response = await fetch(`${API_ENDPOINT}/calendar/availability`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) throw new Error('Failed to load availability');
        
        const data = await response.json();
        userAvailability = new Set(data.userAvailability || []);
        partnerAvailability = new Set(data.partnerAvailability || []);
        
        console.log('Loaded user availability:', Array.from(userAvailability));
        console.log('Loaded partner availability:', Array.from(partnerAvailability));
    } catch (error) {
        console.error('Error loading availability:', error);
    }
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
    document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    const grid = document.getElementById('calendarGrid');
    const headers = grid.querySelectorAll('.calendar-day-header');
    grid.innerHTML = '';
    headers.forEach(header => grid.appendChild(header));
    
    for (let i = firstDay - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        const dayEl = createDayElement(day, true);
        grid.appendChild(dayEl);
    }
    
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
        const isToday = day === today.getDate() && 
                       month === today.getMonth() && 
                       year === today.getFullYear();
        const dayEl = createDayElement(day, false, isToday);
        grid.appendChild(dayEl);
    }
    
    const totalCells = grid.children.length - 7;
    const remainingCells = 42 - totalCells;
    for (let day = 1; day <= remainingCells; day++) {
        const dayEl = createDayElement(day, true);
        grid.appendChild(dayEl);
    }
    
    // Update availability indicators after all elements are in the DOM
    if (!isAdmin) {
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            if (meetingSlots.has(dateStr)) {
                updateAvailabilityIndicator(dateStr);
            }
        }
    }
}

function createDayElement(day, isOtherMonth, isToday = false) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    if (isOtherMonth) dayEl.classList.add('other-month');
    if (isToday) dayEl.classList.add('today');
    
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Debug log for March 14
    if (day === 14 && currentDate.getMonth() === 2) {
        console.log('Creating day 14, dateStr:', dateStr);
        console.log('Has meeting slot:', meetingSlots.has(dateStr));
        console.log('User available:', userAvailability.has(dateStr));
    }
    
    dayEl.innerHTML = `
        <div class="day-number">${day}</div>
        <div class="availability-indicator" id="indicator-${dateStr}"></div>
    `;
    
    if (!isOtherMonth) {
        if (isAdmin) {
            // Admins can click any date to create/delete slots
            dayEl.addEventListener('click', () => openModal(day, dateStr));
            if (meetingSlots.has(dateStr)) {
                dayEl.style.backgroundColor = '#e8f5e9';
            }
        } else if (meetingSlots.has(dateStr)) {
            // Users can only click dates with existing slots
            dayEl.addEventListener('click', () => openModal(day, dateStr));
            // Don't call updateAvailabilityIndicator here - it will be called after DOM is ready
        } else {
            // Non-slot dates are disabled for users
            dayEl.style.opacity = '0.5';
            dayEl.style.cursor = 'not-allowed';
        }
    }
    
    return dayEl;
}

function updateAvailabilityIndicator(dateStr) {
    const indicator = document.getElementById(`indicator-${dateStr}`);
    if (!indicator) {
        console.log('Indicator not found for:', dateStr);
        return;
    }
    
    const userAvail = userAvailability.has(dateStr);
    const partnerAvail = partnerAvailability.has(dateStr);
    
    console.log(`Updating indicator for ${dateStr}: user=${userAvail}, partner=${partnerAvail}`);
    
    indicator.innerHTML = '';
    
    if (userAvail && partnerAvail) {
        indicator.innerHTML = '<div class="availability-badge both">Both Available!</div>';
    } else {
        if (userAvail) {
            indicator.innerHTML += '<div class="availability-badge you">You</div>';
        }
        if (partnerAvail) {
            indicator.innerHTML += '<div class="availability-badge partner">Partner</div>';
        }
    }
}

function openModal(day, dateStr) {
    selectedDate = dateStr;
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateFormatted = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    document.getElementById('modalDate').textContent = dateFormatted;
    
    if (isAdmin) {
        document.getElementById('slotCheckbox').checked = meetingSlots.has(selectedDate);
    } else {
        document.getElementById('availableCheckbox').checked = userAvailability.has(selectedDate);
    }
    
    document.getElementById('availabilityModal').classList.add('show');
}

function closeModal() {
    document.getElementById('availabilityModal').classList.remove('show');
    selectedDate = null;
}

async function saveAvailability() {
    if (!selectedDate) return;
    
    if (isAdmin) {
        await saveAdminSlot();
    } else {
        await saveUserAvailability();
    }
}

async function saveAdminSlot() {
    const slotExists = meetingSlots.has(selectedDate);
    const shouldExist = document.getElementById('slotCheckbox').checked;
    
    try {
        const session = await window.Auth.currentSession();
        const token = session.getIdToken().getJwtToken();
        
        if (shouldExist && !slotExists) {
            // Create slot
            const response = await fetch(`${API_ENDPOINT}/calendar/slots`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ date: selectedDate })
            });
            
            if (!response.ok) throw new Error('Failed to create meeting slot');
            meetingSlots.add(selectedDate);
        } else if (!shouldExist && slotExists) {
            // Delete slot - need to find the slotId
            await loadMeetingSlots(); // Reload to get slotIds
            const slots = await (await fetch(`${API_ENDPOINT}/calendar/slots`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })).json();
            
            const slot = slots.find(s => s.date === selectedDate);
            if (slot) {
                const response = await fetch(`${API_ENDPOINT}/calendar/slots`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ slotId: slot.slotId })
                });
                
                if (!response.ok) throw new Error('Failed to delete meeting slot');
                meetingSlots.delete(selectedDate);
            }
        }
        
        renderCalendar();
        closeModal();
    } catch (error) {
        console.error('Error saving slot:', error);
        alert('Failed to save meeting slot. Please try again.');
    }
}

async function saveUserAvailability() {
    const isAvailable = document.getElementById('availableCheckbox').checked;
    
    try {
        const session = await window.Auth.currentSession();
        const token = session.getIdToken().getJwtToken();
        
        const response = await fetch(`${API_ENDPOINT}/calendar/availability`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                date: selectedDate,
                available: isAvailable
            })
        });
        
        if (!response.ok) throw new Error('Failed to save availability');
        
        if (isAvailable) {
            userAvailability.add(selectedDate);
        } else {
            userAvailability.delete(selectedDate);
        }
        
        updateAvailabilityIndicator(selectedDate);
        closeModal();
    } catch (error) {
        console.error('Error saving availability:', error);
        alert('Failed to save availability. Please try again.');
    }
}

document.getElementById('prevMonth').addEventListener('click', async () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    if (!isAdmin) {
        await loadAvailability();
    }
    renderCalendar();
});

document.getElementById('nextMonth').addEventListener('click', async () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    if (!isAdmin) {
        await loadAvailability();
    }
    renderCalendar();
});

document.getElementById('todayBtn').addEventListener('click', async () => {
    currentDate = new Date();
    if (!isAdmin) {
        await loadAvailability();
    }
    renderCalendar();
});

document.getElementById('closeModal').addEventListener('click', closeModal);
document.getElementById('cancelBtn').addEventListener('click', closeModal);
document.getElementById('saveBtn').addEventListener('click', saveAvailability);

document.getElementById('availabilityModal').addEventListener('click', (e) => {
    if (e.target.id === 'availabilityModal') closeModal();
});

// Sign out handler
const signOutBtn = document.getElementById('signOut');
if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
        try {
            await window.Auth.signOut();
            window.location.replace('logIn.html');
        } catch (err) {
            alert('Sign out error: ' + err.message);
        }
    });
}

initCalendar();
