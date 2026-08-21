import React, { useState } from 'react';
import './App.css';
import LoginScreen from './screens/LoginScreen';
import AttendanceScreen from './screens/AttendanceScreen';
import AdminPanel from './screens/AdminPanel';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [gymData, setGymData] = useState(null);
  const [activeScreen, setActiveScreen] = useState('login');

  const handleLogin = (user, gym) => {
    setCurrentUser(user);
    setGymData(gym);
    
    if (user.role === 'owner' || user.role === 'manager') {
      setActiveScreen('admin');
    } else {
      setActiveScreen('attendance');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setGymData(null);
    setActiveScreen('login');
    localStorage.removeItem('token');
  };

  return (
    <div className="app-container">
      {activeScreen === 'login' && (
        <LoginScreen onLoginSuccess={handleLogin} />
      )}
      {activeScreen === 'attendance' && currentUser && (
        <AttendanceScreen 
          user={currentUser} 
          gym={gymData} 
          onLogout={handleLogout} 
        />
      )}
      {activeScreen === 'admin' && currentUser && (
        <AdminPanel 
          user={currentUser} 
          gym={gymData} 
          onLogout={handleLogout} 
        />
      )}
    </div>
  );
}

export default App;
