import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminPanel.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function AdminPanel({ user, gym, onLogout }) {
  const [activeTab, setActiveTab] = useState('today');
  const [attendance, setAttendance] = useState([]);
  const [staff, setStaff] = useState([]);
  const [stats, setStats] = useState({
    present: 0,
    absent: 0,
    late: 0
  });
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [staffStats, setStaffStats] = useState(null);

  useEffect(() => {
    fetchTodayAttendance();
    fetchStaff();
  }, []);

  const fetchTodayAttendance = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/attendance/today?gym_id=${gym?._id || 'default'}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      setAttendance(response.data);
      
      // Calculate stats
      const present = response.data.filter(a => a.check_in_time).length;
      const late = response.data.filter(a => a.status === 'late').length;
      const absent = (staff.length || 14) - present;

      setStats({ present, absent, late });
    } catch (err) {
      console.log('Error fetching attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/staff?gym_id=${gym?._id || 'default'}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      setStaff(response.data);
    } catch (err) {
      console.log('Error fetching staff:', err);
    }
  };

  const fetchStaffStats = async (staffId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/staff/${staffId}/stats?gym_id=${gym?._id || 'default'}&month=${selectedMonth}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      setStaffStats(response.data);
    } catch (err) {
      console.log('Error fetching staff stats:', err);
    }
  };

  const handleStaffSelect = (staffMember) => {
    setSelectedStaff(staffMember);
    fetchStaffStats(staffMember._id);
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>🏋️ Dashboard - {gym?.name || '4GYM QUSAIS'}</h1>
        <div className="header-actions">
          <span className="user-welcome">👤 {user.name}</span>
          <button onClick={onLogout} className="logout-btn">Logout</button>
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'today' ? 'active' : ''}`}
          onClick={() => setActiveTab('today')}
        >
          📊 Today
        </button>
        <button
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📅 History
        </button>
        <button
          className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          📈 Statistics
        </button>
      </div>

      <div className="admin-content">
        {activeTab === 'today' && (
          <div className="today-tab">
            <div className="stats-cards">
              <div className="stat-card present">
                <div className="stat-number">{stats.present}</div>
                <div className="stat-label">Present</div>
              </div>
              <div className="stat-card absent">
                <div className="stat-number">{stats.absent}</div>
                <div className="stat-label">Absent</div>
              </div>
              <div className="stat-card late">
                <div className="stat-number">{stats.late}</div>
                <div className="stat-label">Late</div>
              </div>
            </div>

            <div className="staff-list">
              <h2>Staff Attendance - Today</h2>
              <button onClick={fetchTodayAttendance} className="refresh-btn">
                🔄 Refresh
              </button>
              
              {loading ? (
                <p>Loading...</p>
              ) : attendance.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Check-In Time</th>
                      <th>Check-Out Time</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((record) => (
                      <tr key={record._id}>
                        <td>{record.user_id?.name || 'Unknown'}</td>
                        <td>
                          {record.check_in_time
                            ? new Date(record.check_in_time).toLocaleTimeString()
                            : '-'}
                        </td>
                        <td>
                          {record.check_out_time
                            ? new Date(record.check_out_time).toLocaleTimeString()
                            : '-'}
                        </td>
                        <td>
                          <span className={`status-badge ${record.status}`}>
                            {record.status === 'checked_in' ? '✅ In' : record.status === 'checked_out' ? '⏹️ Out' : '⏰ Late'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No attendance records yet</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="history-tab">
            <h2>Attendance History</h2>
            <p className="info">View detailed attendance records for all staff members.</p>
            
            <div className="staff-list">
              <h3>All Staff Members</h3>
              {staff.length > 0 ? (
                <ul>
                  {staff.map((member) => (
                    <li key={member._id}>
                      <span>{member.name}</span>
                      <span className="email">{member.email}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No staff members found</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="stats-tab">
            <h2>Monthly Statistics</h2>
            
            <div className="stats-controls">
              <label>Select Month:</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              >
                <option value={1}>January</option>
                <option value={2}>February</option>
                <option value={3}>March</option>
                <option value={4}>April</option>
                <option value={5}>May</option>
                <option value={6}>June</option>
                <option value={7}>July</option>
                <option value={8}>August</option>
                <option value={9}>September</option>
                <option value={10}>October</option>
                <option value={11}>November</option>
                <option value={12}>December</option>
              </select>
            </div>

            <div className="staff-list">
              <h3>Select Staff to View Stats</h3>
              {staff.length > 0 ? (
                <div className="staff-buttons">
                  {staff.map((member) => (
                    <button
                      key={member._id}
                      className={`staff-btn ${selectedStaff?._id === member._id ? 'active' : ''}`}
                      onClick={() => handleStaffSelect(member)}
                    >
                      {member.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p>No staff members found</p>
              )}

              {selectedStaff && staffStats && (
                <div className="staff-stats-detail">
                  <h3>{selectedStaff.name} - {new Date(new Date().getFullYear(), selectedMonth - 1).toLocaleString('default', { month: 'long' })}</h3>
                  <div className="stats-grid">
                    <div className="stat-box">
                      <div className="number">{staffStats.present}</div>
                      <div className="label">Days Present</div>
                    </div>
                    <div className="stat-box">
                      <div className="number">{staffStats.absent}</div>
                      <div className="label">Days Absent</div>
                    </div>
                    <div className="stat-box">
                      <div className="number">{staffStats.late}</div>
                      <div className="label">Late Arrivals</div>
                    </div>
                    <div className="stat-box">
                      <div className="number">{staffStats.attendance_percentage}%</div>
                      <div className="label">Attendance %</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminPanel;
