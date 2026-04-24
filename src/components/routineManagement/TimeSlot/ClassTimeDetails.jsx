import { useState, useEffect, useRef, useMemo, Fragment } from 'react';
import './styles/ClassTimeDetails.css';

// Sample time slot data
const initialClassTimeDetails = {
  startTime: '08:30',
  duration: '01:30',
  classesBeforeLunch: 3,
  lunchDuration: '01:00',
  classesAfterLunch: 2,
  classDay: 'Sunday-Thursday',
  skipTime: '5 mins',
};

const weekDays = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// Helper function to convert time string (HH:MM) to total minutes
const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// Helper function to convert minutes to time string (HH:MM)
const minutesToTime = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

// Helper function to format time with AM/PM
const formatTimeWithPeriod = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
};

// Helper function to get working days from classDay range (circular)
const getWorkingDays = (classDayStr) => {
  const [startDay, endDay] = classDayStr.split('-');
  const startIdx = weekDays.indexOf(startDay.trim());
  const endIdx = weekDays.indexOf(endDay.trim());
  
  const days = [];
  let currentIdx = startIdx;
  
  // Handle circular day flow
  while (true) {
    days.push(weekDays[currentIdx]);
    if (currentIdx === endIdx) break;
    currentIdx = (currentIdx + 1) % weekDays.length;
  }
  
  return days;
};

// Generate time slots based on parameters
const generateTimeSlots = (
  startTime,
  duration,
  classesBeforeLunch,
  lunchDuration,
  classesAfterLunch,
  skipTime
) => {
  const slots = [];
  
  // Parse input times
  const startMinutes = timeToMinutes(startTime);
  const durationMinutes = timeToMinutes(duration);
  const lunchDurationMinutes = timeToMinutes(lunchDuration);
  const skipMinutes = parseInt(skipTime) ?? 5;
  
  let currentMinutes = startMinutes;

  // Generate morning classes
  for (let i = 0; i < classesBeforeLunch; i++) {
    const startTimeStr = minutesToTime(currentMinutes);
    const endTimeStr = minutesToTime(currentMinutes + durationMinutes);
    
    slots.push({
      id: i + 1,
      start: startTimeStr,
      end: endTimeStr,
      startPeriod: formatTimeWithPeriod(startTimeStr),
      endPeriod: formatTimeWithPeriod(endTimeStr),
      type: 'class',
    });
    
    currentMinutes += durationMinutes + skipMinutes;
  }

  // Calculate lunch time
  const lunchStartMinutes = currentMinutes;
  const lunchEndMinutes = lunchStartMinutes + lunchDurationMinutes;
  
  slots.push({
    id: 'lunch',
    start: minutesToTime(lunchStartMinutes),
    end: minutesToTime(lunchEndMinutes),
    startPeriod: formatTimeWithPeriod(minutesToTime(lunchStartMinutes)),
    endPeriod: formatTimeWithPeriod(minutesToTime(lunchEndMinutes)),
    type: 'lunch',
  });

  // Generate afternoon classes
  currentMinutes = lunchEndMinutes + skipMinutes;
  for (let i = 0; i < classesAfterLunch; i++) {
    const startTimeStr = minutesToTime(currentMinutes);
    const endTimeStr = minutesToTime(currentMinutes + durationMinutes);
    
    slots.push({
      id: classesBeforeLunch + 1 + i,
      start: startTimeStr,
      end: endTimeStr,
      startPeriod: formatTimeWithPeriod(startTimeStr),
      endPeriod: formatTimeWithPeriod(endTimeStr),
      type: 'class',
    });
    
    currentMinutes += durationMinutes + skipMinutes;
  }

  return slots;
};

// Time Picker Modal Component
function TimePickerModal({ isOpen, title, currentTime, onConfirm, onCancel, showAmPm = false }) {
  const [hours, setHours] = useState(currentTime.split(':')[0] || '08');
  const [minutes, setMinutes] = useState(currentTime.split(':')[1] || '00');
  
  const calculatePeriod = () => {
    const h = parseInt(currentTime.split(':')[0] || '08');
    return h >= 12 ? 'PM' : 'AM';
  };
  
  const [period, setPeriod] = useState(showAmPm ? calculatePeriod() : 'AM');
  const hoursInputRef = useRef(null);
  const minutesInputRef = useRef(null);

  const handleHourChange = (e) => {
    let value = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
    setHours(value);
    if (value.length === 2) {
      setTimeout(() => {
        const minuteInput = document.getElementById('minute-input');
        if (minuteInput) {
          minuteInput.focus();
          minuteInput.select();
        }
      }, 0);
    }
  };

  const handleMinuteChange = (e) => {
    let value = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
    setMinutes(value);
  };

  const handleHourKeyDown = (e) => {
    if (e.key === 'Enter') {
      const paddedHour = String(hours || '0').padStart(2, '0');
      setHours(paddedHour);
      setTimeout(() => {
        const minuteInput = document.getElementById('minute-input');
        if (minuteInput) {
          minuteInput.focus();
          minuteInput.select();
        }
      }, 0);
    }
  };

  const handleMinuteKeyDown = (e) => {
    if (e.key === 'Enter') {
      const paddedMinute = String(minutes || '0').padStart(2, '0');
      setMinutes(paddedMinute);
      handleConfirm();
    }
  };

  const handleConfirm = () => {
    const paddedHours = String(hours || '0').padStart(2, '0');
    const paddedMinutes = String(minutes || '0').padStart(2, '0');
    const timeValue = `${paddedHours}:${paddedMinutes}`;
    onConfirm(timeValue);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{title}</h3>
        <div className="time-picker-container">
          <div className="time-input-group">
            <label>Hour</label>
            <input
              id="hour-input"
              type="text"
              inputMode="numeric"
              value={hours}
              onChange={handleHourChange}
              onKeyDown={handleHourKeyDown}
              onFocus={(e) => e.target.select()}
              className="time-input"
              maxLength="2"
            />
          </div>
          <div className="time-separator">:</div>
          <div className="time-input-group">
            <label>Minute</label>
            <input
              id="minute-input"
              type="text"
              inputMode="numeric"
              value={minutes}
              onChange={handleMinuteChange}
              onKeyDown={handleMinuteKeyDown}
              onFocus={(e) => e.target.select()}
              className="time-input"
              maxLength="2"
            />
          </div>
          {showAmPm && (
            <div className="time-period-group">
              <label>Period</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="period-select"
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          )}
        </div>
        <div className="modal-buttons">
          <button className="modal-btn cancel-btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="modal-btn confirm-btn" onClick={handleConfirm}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

// Duration Picker Modal Component
function DurationPickerModal({ isOpen, title, currentDuration, onConfirm, onCancel }) {
  const [hours, setHours] = useState(currentDuration.split(':')[0] || '00');
  const [minutes, setMinutes] = useState(currentDuration.split(':')[1] || '00');

  const handleHourChange = (e) => {
    let value = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
    setHours(value);
    if (value.length === 2) {
      setTimeout(() => {
        const minuteInput = document.getElementById('duration-minute-input');
        if (minuteInput) {
          minuteInput.focus();
          minuteInput.select();
        }
      }, 0);
    }
  };

  const handleMinuteChange = (e) => {
    let value = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
    setMinutes(value);
  };

  const handleHourKeyDown = (e) => {
    if (e.key === 'Enter') {
      const paddedHour = String(hours || '0').padStart(2, '0');
      setHours(paddedHour);
      setTimeout(() => {
        const minuteInput = document.getElementById('duration-minute-input');
        if (minuteInput) {
          minuteInput.focus();
          minuteInput.select();
        }
      }, 0);
    }
  };

  const handleMinuteKeyDown = (e) => {
    if (e.key === 'Enter') {
      const paddedMinute = String(minutes || '0').padStart(2, '0');
      setMinutes(paddedMinute);
      handleConfirm();
    }
  };

  const handleConfirm = () => {
    const paddedHours = String(hours || '0').padStart(2, '0');
    const paddedMinutes = String(minutes || '0').padStart(2, '0');
    onConfirm(`${paddedHours}:${paddedMinutes}`);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{title}</h3>
        <div className="duration-picker-container">
          <div className="duration-input-group">
            <label>Hours</label>
            <input
              id="duration-hour-input"
              type="text"
              inputMode="numeric"
              value={hours}
              onChange={handleHourChange}
              onKeyDown={handleHourKeyDown}
              onFocus={(e) => e.target.select()}
              className="duration-input"
              maxLength="2"
            />
          </div>
          <div className="duration-separator">:</div>
          <div className="duration-input-group">
            <label>Minutes</label>
            <input
              id="duration-minute-input"
              type="text"
              inputMode="numeric"
              value={minutes}
              onChange={handleMinuteChange}
              onKeyDown={handleMinuteKeyDown}
              onFocus={(e) => e.target.select()}
              className="duration-input"
              maxLength="2"
            />
          </div>
        </div>
        <div className="modal-buttons">
          <button className="modal-btn cancel-btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="modal-btn confirm-btn" onClick={handleConfirm}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

// Day Selection Modal Component
function DaySelectionModal({ isOpen, currentDay, onConfirm, onCancel }) {
  const [startDay, setStartDay] = useState(currentDay.split('-')[0] || 'Monday');
  const [endDay, setEndDay] = useState(currentDay.split('-')[1] || 'Friday');

  const handleConfirm = () => {
    onConfirm(`${startDay}-${endDay}`);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Select Class Days</h3>
        <div className="day-picker-container">
          <div className="day-input-group">
            <label>Starting Day</label>
            <select value={startDay} onChange={(e) => setStartDay(e.target.value)} className="day-select">
              {weekDays.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </div>
          <div className="day-input-group">
            <label>Ending Day</label>
            <select value={endDay} onChange={(e) => setEndDay(e.target.value)} className="day-select">
              {weekDays.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="modal-buttons">
          <button className="modal-btn cancel-btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="modal-btn confirm-btn" onClick={handleConfirm}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

// Dropdown Component for numeric selection
function NumericDropdown({ isOpen, value, onSelect, onClose, buttonRef, parentRef, maxValue = 10 }) {
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isOpen && buttonRef?.current && parentRef?.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const parentRect = parentRef.current.getBoundingClientRect();
      setDropdownPos({
        top: buttonRect.bottom - parentRect.top,
        left: buttonRect.left - parentRect.left,
      });
    }
  }, [isOpen, buttonRef, parentRef]);

  if (!isOpen) return null;

  return (
    <div className="dropdown-overlay" onClick={onClose}>
      <div
        className="dropdown-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: `${dropdownPos.top}px`,
          left: `${dropdownPos.left}px`,
        }}
      >
        {Array.from({ length: maxValue + 1 }, (_, i) => i).map((num) => (
          <div
            key={num}
            className={`dropdown-item ${value === num ? 'selected' : ''}`}
            onClick={() => {
              onSelect(num);
              onClose();
            }}
          >
            {num}
          </div>
        ))}
      </div>
    </div>
  );
}

function ClassTimeDetails() {
  const [classTimeDetails, setClassTimeDetails] = useState(initialClassTimeDetails);
  const [appliedClassTimeDetails, setAppliedClassTimeDetails] = useState(initialClassTimeDetails);
  const [saveStatus, setSaveStatus] = useState('saved');
  
  const [openModal, setOpenModal] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);
  
  const classesBeforeLunchBtnRef = useRef(null);
  const classesAfterLunchBtnRef = useRef(null);
  const skipTimeBtnRef = useRef(null);
  const timeslotFieldsRef = useRef(null);

  // Time Picker Modal Handlers
  const handleEditStartTime = () => setOpenModal('startTime');
  const handleConfirmStartTime = (time) => {
    setClassTimeDetails({ ...classTimeDetails, startTime: time });
    setSaveStatus('pending');
    setOpenModal(null);
  };

  const handleEditDuration = () => setOpenModal('duration');
  const handleConfirmDuration = (duration) => {
    setClassTimeDetails({ ...classTimeDetails, duration });
    setSaveStatus('pending');
    setOpenModal(null);
  };

  const handleEditLunchDuration = () => setOpenModal('lunchDuration');
  const handleConfirmLunchDuration = (duration) => {
    setClassTimeDetails({ ...classTimeDetails, lunchDuration: duration });
    setSaveStatus('pending');
    setOpenModal(null);
  };

  const handleEditClassDay = () => setOpenModal('classDay');
  const handleConfirmClassDay = (days) => {
    setClassTimeDetails({ ...classTimeDetails, classDay: days });
    setSaveStatus('pending');
    setOpenModal(null);
  };

  // Dropdown Handlers
  const handleEditClassesBeforeLunch = (num) => {
    setClassTimeDetails({ ...classTimeDetails, classesBeforeLunch: num });
    setSaveStatus('pending');
    setOpenDropdown(null);
  };

  const handleEditClassesAfterLunch = (num) => {
    setClassTimeDetails({ ...classTimeDetails, classesAfterLunch: num });
    setSaveStatus('pending');
    setOpenDropdown(null);
  };

  const handleEditSkipTime = (num) => {
    setClassTimeDetails({ ...classTimeDetails, skipTime: `${num} mins` });
    setSaveStatus('pending');
    setOpenDropdown(null);
  };

  const handleSaveAll = () => {
    setAppliedClassTimeDetails(classTimeDetails);
    setSaveStatus('saved');
  };

  const { timeSlots, workingDays } = useMemo(() => {
    const slots = generateTimeSlots(
      appliedClassTimeDetails.startTime,
      appliedClassTimeDetails.duration,
      appliedClassTimeDetails.classesBeforeLunch,
      appliedClassTimeDetails.lunchDuration,
      appliedClassTimeDetails.classesAfterLunch,
      appliedClassTimeDetails.skipTime
    );
    
    const days = getWorkingDays(appliedClassTimeDetails.classDay);
    
    return { timeSlots: slots, workingDays: days };
  }, [
    appliedClassTimeDetails.startTime,
    appliedClassTimeDetails.duration,
    appliedClassTimeDetails.classesBeforeLunch,
    appliedClassTimeDetails.lunchDuration,
    appliedClassTimeDetails.classesAfterLunch,
    appliedClassTimeDetails.skipTime,
    appliedClassTimeDetails.classDay,
  ]);

  return (
    <div className="class-time-details-container">
      <div className="timeslot-layout">
        {/* Left Side - Fields */}
        <div className="timeslot-fields" ref={timeslotFieldsRef}>
          <div className="field-item">
            <label className="field-label">Class Start Time</label>
            <div className="field-value-container">
              <span className="field-value">{formatTimeWithPeriod(classTimeDetails.startTime)}</span>
              <button className="edit-btn" onClick={handleEditStartTime}>
                Edit
              </button>
            </div>
          </div>

          <div className="field-item">
            <label className="field-label">Class Duration</label>
            <div className="field-value-container">
              <span className="field-value">{classTimeDetails.duration}</span>
              <button className="edit-btn" onClick={handleEditDuration}>
                Edit
              </button>
            </div>
          </div>

          <div className="field-item">
            <label className="field-label">Classes Before Lunch</label>
            <div className="field-value-container">
              <span className="field-value">{classTimeDetails.classesBeforeLunch}</span>
              <button
                ref={classesBeforeLunchBtnRef}
                className="edit-btn"
                onClick={() => setOpenDropdown('classesBeforeLunch')}
              >
                Edit
              </button>
            </div>
          </div>

          <div className="field-item">
            <label className="field-label">Lunch Duration</label>
            <div className="field-value-container">
              <span className="field-value">{classTimeDetails.lunchDuration}</span>
              <button className="edit-btn" onClick={handleEditLunchDuration}>
                Edit
              </button>
            </div>
          </div>

          <div className="field-item">
            <label className="field-label">Classes After Lunch</label>
            <div className="field-value-container">
              <span className="field-value">{classTimeDetails.classesAfterLunch}</span>
              <button
                ref={classesAfterLunchBtnRef}
                className="edit-btn"
                onClick={() => setOpenDropdown('classesAfterLunch')}
              >
                Edit
              </button>
            </div>
          </div>

          <div className="field-item">
            <label className="field-label">Class Day</label>
            <div className="field-value-container">
              <span className="field-value">{classTimeDetails.classDay}</span>
              <button className="edit-btn" onClick={handleEditClassDay}>
                Edit
              </button>
            </div>
          </div>

          <div className="field-item">
            <label className="field-label">Skip Time</label>
            <div className="field-value-container">
              <span className="field-value">{classTimeDetails.skipTime}</span>
              <button
                ref={skipTimeBtnRef}
                className="edit-btn"
                onClick={() => setOpenDropdown('skipTime')}
              >
                Edit
              </button>
            </div>
          </div>
        </div>

        {/* Right Side - Grid View */}
        <div className="timeslot-grid-container">
          <div className="grid-save-section">
            <button 
              className={`save-all-btn ${saveStatus === 'pending' ? 'pending' : 'saved'}`}
              onClick={handleSaveAll}
              disabled={saveStatus === 'saved'}
            >
              {saveStatus === 'saved' ? '✓ Saved' : 'Save All'}
            </button>
          </div>
          <div className="grid-wrapper-scroll">
            <div 
              className="grid-wrapper"
              style={{
                gridTemplateColumns: `120px repeat(${timeSlots.length}, 1fr)`,
                gridTemplateRows: `auto repeat(${workingDays.length}, 1fr)`,
              }}
            >
            {/* Grid Header */}
            <div className="grid-day-cell">Day</div>
            {timeSlots.map((slot) => (
              <div key={`header-${slot.id}`} className={`grid-header-cell ${slot.type}`}>
                {slot.type === 'lunch' ? (
                  <div className="lunch-header">
                    <div className="lunch-label">Break</div>
                    <div className="slot-time">{slot.startPeriod}</div>
                    <div className="slot-time-divider">-</div>
                    <div className="slot-time">{slot.endPeriod}</div>
                  </div>
                ) : (
                  <div className="class-header">
                    <div className="slot-time">{slot.startPeriod}</div>
                    <div className="slot-time-divider">-</div>
                    <div className="slot-time">{slot.endPeriod}</div>
                  </div>
                )}
              </div>
            ))}

            {/* Grid Rows */}
            {workingDays.map((day) => (
              <Fragment key={day}>
                <div className="grid-day-label">{day}</div>
                {timeSlots.map((slot) => (
                  <div
                    key={`${day}-${slot.id}`}
                    className={`grid-cell ${slot.type} ${
                      slot.type === 'lunch' ? 'lunch-cell' : ''
                    }`}
                  >
                    {slot.type === 'class' && <div className="class-indicator"></div>}
                  </div>
                ))}
              </Fragment>
            ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <TimePickerModal
        isOpen={openModal === 'startTime'}
        title="Select Class Start Time"
        currentTime={classTimeDetails.startTime}
        onConfirm={handleConfirmStartTime}
        onCancel={() => setOpenModal(null)}
        showAmPm={true}
      />

      <DurationPickerModal
        isOpen={openModal === 'duration'}
        title="Select Class Duration"
        currentDuration={classTimeDetails.duration}
        onConfirm={handleConfirmDuration}
        onCancel={() => setOpenModal(null)}
      />

      <DurationPickerModal
        isOpen={openModal === 'lunchDuration'}
        title="Select Lunch Duration"
        currentDuration={classTimeDetails.lunchDuration}
        onConfirm={handleConfirmLunchDuration}
        onCancel={() => setOpenModal(null)}
      />

      <DaySelectionModal
        isOpen={openModal === 'classDay'}
        currentDay={classTimeDetails.classDay}
        onConfirm={handleConfirmClassDay}
        onCancel={() => setOpenModal(null)}
      />

      {/* Numeric Dropdowns */}
      <NumericDropdown
        isOpen={openDropdown === 'classesBeforeLunch'}
        value={classTimeDetails.classesBeforeLunch}
        onSelect={handleEditClassesBeforeLunch}
        onClose={() => setOpenDropdown(null)}
        buttonRef={classesBeforeLunchBtnRef}
        parentRef={timeslotFieldsRef}
      />

      <NumericDropdown
        isOpen={openDropdown === 'classesAfterLunch'}
        value={classTimeDetails.classesAfterLunch}
        onSelect={handleEditClassesAfterLunch}
        onClose={() => setOpenDropdown(null)}
        buttonRef={classesAfterLunchBtnRef}
        parentRef={timeslotFieldsRef}
      />

      <NumericDropdown
        isOpen={openDropdown === 'skipTime'}
        value={parseInt(classTimeDetails.skipTime) || 0}
        onSelect={handleEditSkipTime}
        onClose={() => setOpenDropdown(null)}
        buttonRef={skipTimeBtnRef}
        parentRef={timeslotFieldsRef}
        maxValue={15}
      />
    </div>
  );
}

export default ClassTimeDetails;
