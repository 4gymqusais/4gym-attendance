import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './AttendanceScreen.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function AttendanceScreen({ user, gym, onLogout }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [cameraActive, setCameraActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [attendanceStatus, setAttendanceStatus] = useState(null);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [faceDetected, setFaceDetected] = useState(false);

  useEffect(() => {
    startCamera();
    fetchTodayStatus();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      setMessage('❌ Camera access denied. Please enable camera permissions.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    setLoading(true);
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (canvas && video) {
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL('image/jpeg');
      setPhoto(imageData);
      setFaceDetected(true);
      setMessage('✅ Photo captured! Face detected.');
    }
    setLoading(false);
  };

  const handleCheckIn = async () => {
    if (!photo) {
      setMessage('❌ Please capture a photo first');
      return;
    }

    setLoading(true);
    try {
      const canvas = canvasRef.current;
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
      
      const formData = new FormData();
      formData.append('photo', blob, 'checkin.jpg');
      formData.append('gym_id', gym?._id || 'default-gym');
      formData.append('latitude', 25.2518);
      formData.append('longitude', 55.3783);
      formData.append('accuracy', 10);

      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/api/attendance/check-in`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setMessage(`✅ ${response.data.message}`);
      setAttendanceStatus({ status: 'checked_in', time: new Date().toLocaleTimeString() });
      setPhoto(null);
      setFaceDetected(false);
      
      // Reset after 2 seconds
      setTimeout(() => {
        setMessage('');
        setPhoto(null);
      }, 2000);
    } catch (err) {
      setMessage(`❌ ${err.response?.data?.error || 'Check-in failed'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!photo) {
      setMessage('❌ Please capture a photo first');
      return;
    }

    setLoading(true);
    try {
      const canvas = canvasRef.current;
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
      
      const formData = new FormData();
      formData.append('photo', blob, 'checkout.jpg');
      formData.append('attendance_id', todayAttendance?._id);
      formData.append('latitude', 25.2518);
      formData.append('longitude', 55.3783);
      formData.append('accuracy', 10);

      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/api/attendance/check-out`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setMessage(`✅ ${response.data.message}`);
      setAttendanceStatus({ status: 'checked_out', time: new Date().toLocaleTimeString() });
      setPhoto(null);
      setFaceDetected(false);

      setTimeout(() => {
        setMessage('');
        setPhoto(null);
      }, 2000);
    } catch (err) {
      setMessage(`❌ ${err.response?.data?.error || 'Check-out failed'}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/attendance/today?gym_id=${gym?._id || 'default'}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      const userAttendance = response.data.find(a => a.user_id === user.id);
      if (userAttendance) {
        setTodayAttendance(userAttendance);
        if (userAttendance.check_in_time) {
          setAttendanceStatus({
            status: userAttendance.check_out_time ? 'checked_out' : 'checked_in',
            time: new Date(userAttendance.check_in_time).toLocaleTimeString()
          });
        }
      }
    } catch (err) {
      console.log('Could not fetch today status');
    }
  };

  const retakePhoto = () => {
    setPhoto(null);
    setFaceDetected(false);
    setMessage('📷 Camera ready. Capture new photo.');
  };

  return (
    <div className="attendance-container">
      <div className="attendance-header">
        <h1>🏋️ Check-In/Out</h1>
        <button onClick={onLogout} className="logout-btn">Logout</button>
      </div>

      <div className="attendance-content">
        <div className="camera-section">
          {!photo ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="video-feed"
              />
              <button
                onClick={capturePhoto}
                className="capture-btn"
                disabled={loading}
              >
                📷 Capture Photo
              </button>
            </>
          ) : (
            <>
              <canvas
                ref={canvasRef}
                width="400"
                height="300"
                style={{ display: 'none' }}
              />
              <img src={photo} alt="Captured" className="photo-preview" />
              <div className="photo-buttons">
                <button
                  onClick={retakePhoto}
                  className="retake-btn"
                  disabled={loading}
                >
                  🔄 Retake
                </button>
              </div>
            </>
          )}
        </div>

        <div className="status-section">
          <div className="user-info">
            <h2>{user.name}</h2>
            <p>{user.email}</p>
          </div>

          {attendanceStatus && (
            <div className={`status-badge ${attendanceStatus.status}`}>
              {attendanceStatus.status === 'checked_in' ? '✅ Checked In' : '⏹️ Checked Out'}
              <br />
              <small>{attendanceStatus.time}</small>
            </div>
          )}

          {faceDetected && !attendanceStatus?.status && (
            <div className="actions">
              <button
                onClick={handleCheckIn}
                className="action-btn check-in"
                disabled={loading}
              >
                {loading ? '⏳ Processing...' : '✅ Check In'}
              </button>
              <button
                onClick={handleCheckOut}
                className="action-btn check-out"
                disabled={loading}
              >
                {loading ? '⏳ Processing...' : '⏹️ Check Out'}
              </button>
            </div>
          )}

          {faceDetected && attendanceStatus?.status === 'checked_in' && (
            <button
              onClick={handleCheckOut}
              className="action-btn check-out full"
              disabled={loading}
            >
              {loading ? '⏳ Processing...' : '⏹️ Check Out'}
            </button>
          )}

          {message && (
            <div className={`message ${message.includes('❌') ? 'error' : 'success'}`}>
              {message}
            </div>
          )}

          <div className="today-summary">
            <h3>Today's Status</h3>
            {todayAttendance ? (
              <>
                <p>✅ Checked In: {new Date(todayAttendance.check_in_time).toLocaleTimeString()}</p>
                {todayAttendance.check_out_time && (
                  <p>⏹️ Checked Out: {new Date(todayAttendance.check_out_time).toLocaleTimeString()}</p>
                )}
              </>
            ) : (
              <p>Not checked in yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AttendanceScreen;
