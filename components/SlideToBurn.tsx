"use client";

import { useState, useRef, useEffect } from "react";

export function SlideToBurn({
  onComplete,
  disabled,
  text,
  isIntense,
}: {
  onComplete: () => void;
  disabled: boolean;
  text: string;
  isIntense: boolean;
}) {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [success, setSuccess] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (success) {
      // Revert back after a bit if the parent didn't unmount us
      const t = setTimeout(() => {
        setSuccess(false);
        setDragOffset(0);
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [success]);

  useEffect(() => {
    function handleMouseUp() {
      if (!isDragging) return;
      setIsDragging(false);

      if (trackRef.current && thumbRef.current) {
        const trackWidth = trackRef.current.offsetWidth;
        const thumbWidth = thumbRef.current.offsetWidth;
        const maxOffset = trackWidth - thumbWidth;

        if (dragOffset > maxOffset * 0.8) {
          setDragOffset(maxOffset);
          setSuccess(true);
          onComplete();
        } else {
          setDragOffset(0);
        }
      }
    }

    function handleMouseMove(e: MouseEvent | TouchEvent) {
      if (!isDragging || disabled || success) return;
      if (!trackRef.current || !thumbRef.current) return;

      const trackRect = trackRef.current.getBoundingClientRect();
      const thumbWidth = thumbRef.current.offsetWidth;

      let clientX = 0;
      if ("touches" in e) {
        clientX = e.touches[0].clientX;
      } else {
        clientX = e.clientX;
      }

      let newOffset = clientX - trackRect.left - thumbWidth / 2;
      const maxOffset = trackRect.width - thumbWidth;

      if (newOffset < 0) newOffset = 0;
      if (newOffset > maxOffset) newOffset = maxOffset;

      setDragOffset(newOffset);
    }

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleMouseMove, { passive: false });
      window.addEventListener("touchend", handleMouseUp);
      window.addEventListener("touchcancel", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleMouseMove);
      window.removeEventListener("touchend", handleMouseUp);
      window.removeEventListener("touchcancel", handleMouseUp);
    };
  }, [isDragging, dragOffset, disabled, success, onComplete]);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled || success) return;
    setIsDragging(true);
  };

  const handleTrackClick = () => {
    if (disabled || success || isDragging) return;
    
    if (trackRef.current && thumbRef.current) {
      const trackWidth = trackRef.current.offsetWidth;
      const thumbWidth = thumbRef.current.offsetWidth;
      const maxOffset = trackWidth - thumbWidth;
      
      setDragOffset(maxOffset);
      setSuccess(true);
      setTimeout(() => {
        onComplete();
      }, 300);
    }
  };

  return (
    <div
      ref={trackRef}
      onClick={handleTrackClick}
      style={{
        position: "relative",
        width: "100%",
        height: "60px",
        background: disabled ? "var(--dot-color)" : isIntense ? "var(--accent-bkash)" : "var(--card-bg)",
        border: "3px solid var(--border-color)",
        boxShadow: disabled ? "2px 2px 0px 0px var(--border-color)" : "6px 6px 0px 0px var(--border-color)",
        marginTop: "8px",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "background 0.3s",
        animation: isIntense && !disabled && !success ? "savageShake 0.4s ease-in-out infinite alternate" : "none",
        touchAction: "none",
      }}
    >
      {/* 
        Responsive Text Container:
        Using absolute positioning to occupy exactly the space AFTER the thumb.
        This guarantees the thumb never overlays the text before sliding,
        and flexbox centers the text beautifully in the remaining space.
      */}
      <div
        style={{
          position: "absolute",
          left: "60px", // match thumb width
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "0 8px", // breather room so text doesn't hit the right border
          zIndex: 2,
          opacity: success ? 0 : 1,
          transition: "opacity 0.2s",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono), sans-serif",
            fontWeight: 900,
            fontSize: "clamp(10px, 4vw, 15px)", // Super adaptive
            color: disabled ? "var(--text-main)" : isIntense ? "#fff" : "var(--text-main)",
            textTransform: "uppercase",
            letterSpacing: "0px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {disabled ? text : `>>> ${text} >>>`}
        </span>
      </div>

      {success && (
        <span
          style={{
            position: "absolute",
            width: "100%",
            textAlign: "center",
            fontFamily: "var(--font-mono), sans-serif",
            fontWeight: 900,
            fontSize: "clamp(16px, 5vw, 20px)",
            color: isIntense ? "#fff" : "var(--accent-bkash)",
            textTransform: "uppercase",
            pointerEvents: "none",
            animation: "fadeIn 0.2s forwards",
            zIndex: 3,
          }}
        >
          BURNING... 🔥
        </span>
      )}

      <div
        ref={thumbRef}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: "60px", // reduced from 80px to save precious mobile space
          background: "var(--text-main)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `translateX(${dragOffset}px)`,
          transition: isDragging ? "none" : "transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          zIndex: 10,
          cursor: disabled ? "not-allowed" : "grab",
          touchAction: "none",
        }}
      >
        <div style={{ 
          color: "#fff", 
          fontWeight: 900, 
          fontSize: "20px", 
          pointerEvents: "none", 
          letterSpacing: "-2px",
          animation: isDragging ? "none" : "arrowPulse 1.2s infinite ease-in-out"
        }}>
          {">>>>"}
        </div>
      </div>
      
      {/* Visual burn effect that follows the thumb */}
      {!disabled && !success && (
        <div 
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: dragOffset + 30,
            background: isIntense ? "#000" : "var(--accent-neutral)",
            zIndex: 1,
            pointerEvents: "none",
            transition: isDragging ? "none" : "width 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          }}
        />
      )}
    </div>

  );
}
