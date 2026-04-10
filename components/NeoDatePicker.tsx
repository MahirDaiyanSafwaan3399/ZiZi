"use client";

import { useEffect, useRef, useState } from "react";

interface NeoDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (val: string) => void;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function parseIso(dateStr: string) {
  const [yyyy, mm, dd] = dateStr.split("-").map(Number);
  return new Date(yyyy, mm - 1, dd);
}

function formatIso(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function NeoDatePicker({ value, onChange }: NeoDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // viewDate drives the calendar grid
  const initialData = value ? parseIso(value) : new Date();
  const [viewDate, setViewDate] = useState(initialData);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    else document.removeEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const handlePrevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const handleSelect = (day: number) => {
    const selected = new Date(year, month, day);
    onChange(formatIso(selected));
    setIsOpen(false);
  };

  const selectedDate = value ? parseIso(value) : null;
  const isSelected = (d: number) => {
    if (!selectedDate) return false;
    return selectedDate.getFullYear() === year && selectedDate.getMonth() === month && selectedDate.getDate() === d;
  };

  const isToday = (d: number) => {
    const today = new Date();
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
  };

  const displayString = selectedDate 
     ? `${MONTHS[selectedDate.getMonth()]} ${selectedDate.getDate()}, ${selectedDate.getFullYear()}` 
     : "SELECT DATE";

  return (
    <div className="neo-datepicker-container" ref={containerRef}>
      <button 
        type="button"
        className="neo-input datepicker-trigger" 
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="trigger-icon">📅</span>
        <span className="trigger-text">{displayString}</span>
      </button>

      {isOpen && (
        <div className="neo-datepicker-popover">
          <div className="datepicker-header">
            <button type="button" className="action-btn small" onClick={handlePrevMonth}>{"<"}</button>
            <div className="datepicker-title">{MONTHS[month]} {year}</div>
            <button type="button" className="action-btn small" onClick={handleNextMonth}>{">"}</button>
          </div>

          <div className="datepicker-grid">
            {DAYS.map(day => (
              <div key={day} className="datepicker-day-name">{day}</div>
            ))}
            
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`blank-${i}`} className="datepicker-cell empty" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1;
              const sel = isSelected(d);
              const tod = isToday(d);
              return (
                <button
                  type="button"
                  key={d}
                  onClick={() => handleSelect(d)}
                  className={`datepicker-cell ${sel ? "selected" : ""} ${tod ? "today" : ""}`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
