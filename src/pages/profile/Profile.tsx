import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, User, Mail, Lock, ArrowLeft, Check, Loader2, Trash2 } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useThemeStore from '../../store/themeStore';
import api from '../../services/api';

const Profile = () => {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const { isDark } = useThemeStore();

  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar || null);
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bg = isDark ? 'bg-gray-950' : 'bg-gray-50';
  const cardBg = isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-500';
  const inputBg = isDark
    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
    : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400';

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 3000);
  };

  const showError = (msg: string) => {
    setError(msg);
    setSuccess('');
    setTimeout(() => setError(''), 3000);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showError('Image too large! Max 5MB allowed.');
      return;
    }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) return;
    setAvatarLoading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', avatarFile);
      const response = await api.post('/users/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUser({ ...user!, avatar: response.data.avatar });
      setAvatarFile(null);
      showSuccess('Avatar updated successfully!');
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to upload avatar');
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    setAvatarLoading(true);
    try {
      await api.delete('/users/avatar');
      setUser({ ...user!, avatar: '' });
      setAvatarPreview(null);
      setAvatarFile(null);
      showSuccess('Avatar removed!');
    } catch (err: any) {
      showError('Failed to remove avatar');
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const response = await api.put('/users/profile', { name });
      setUser({ ...user!, name: response.data.user.name });
      showSuccess('Profile updated successfully!');
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    if (newPassword.length < 6) {
      showError('New password must be at least 6 characters');
      return;
    }
    setPasswordLoading(true);
    try {
      await api.put('/users/change-password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      showSuccess('Password changed successfully!');
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className={`min-h-screen ${bg} transition-colors`}>

      {/* Header */}
      <div className={`${cardBg} border-b px-6 py-4 sticky top-0 z-10`}>
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${
              isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
            }`}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className={`text-lg font-bold ${textPrimary}`}>Edit Profile</h1>
            <p className={`text-xs ${textSecondary}`}>Update your personal information</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-6">

        {/* Success / Error Toast */}
        {success && (
          <div className="flex items-center gap-2 bg-green-500 bg-opacity-10 border border-green-500 border-opacity-30 text-green-400 p-4 rounded-xl text-sm">
            <Check size={16} /> {success}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 bg-red-500 bg-opacity-10 border border-red-500 border-opacity-30 text-red-400 p-4 rounded-xl text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Avatar Section */}
        <div className={`${cardBg} border rounded-2xl p-6`}>
          <h2 className={`font-bold ${textPrimary} mb-6 flex items-center gap-2`}>
            <Camera size={18} className="text-blue-500" /> Profile Photo
          </h2>

          <div className="flex items-center gap-6">
            {/* Avatar Preview */}
            <div className="relative">
              <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-blue-500 flex-shrink-0">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-blue-600 flex items-center justify-center text-4xl text-white font-bold">
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white hover:bg-blue-500 transition shadow-lg"
              >
                <Camera size={14} />
              </button>
            </div>

            <div className="flex-1">
              <p className={`text-sm font-medium ${textPrimary} mb-1`}>{user?.name}</p>
              <p className={`text-xs ${textSecondary} mb-4`}>{user?.email}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`text-xs px-4 py-2 rounded-xl border transition ${
                    isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Choose Photo
                </button>
                {avatarFile && (
                  <button
                    onClick={handleAvatarUpload}
                    disabled={avatarLoading}
                    className="text-xs px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition flex items-center gap-1"
                  >
                    {avatarLoading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    Save Photo
                  </button>
                )}
                {avatarPreview && !avatarFile && (
                  <button
                    onClick={handleDeleteAvatar}
                    disabled={avatarLoading}
                    className="text-xs px-4 py-2 rounded-xl bg-red-600 bg-opacity-10 text-red-400 hover:bg-opacity-20 disabled:opacity-50 transition flex items-center gap-1"
                  >
                    {avatarLoading ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>

        {/* Profile Info */}
        <div className={`${cardBg} border rounded-2xl p-6`}>
          <h2 className={`font-bold ${textPrimary} mb-6 flex items-center gap-2`}>
            <User size={18} className="text-blue-500" /> Personal Information
          </h2>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Full Name</label>
              <div className="relative">
                <User size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${textSecondary}`} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full border rounded-xl px-4 py-3 pl-9 focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBg}`}
                  placeholder="Your full name"
                />
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Email Address</label>
              <div className="relative">
                <Mail size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${textSecondary}`} />
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className={`w-full border rounded-xl px-4 py-3 pl-9 opacity-50 cursor-not-allowed ${inputBg}`}
                />
              </div>
              <p className={`text-xs ${textSecondary} mt-1`}>Email cannot be changed</p>
            </div>

            <div>
              <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Role</label>
              <div className={`border rounded-xl px-4 py-3 ${inputBg} opacity-50`}>
                <span className="capitalize">{user?.role}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || name === user?.name}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-500 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 size={18} className="animate-spin" /> Saving...</> : <><Check size={18} /> Save Changes</>}
            </button>
          </form>
        </div>

        {/* Change Password */}
        <div className={`${cardBg} border rounded-2xl p-6`}>
          <h2 className={`font-bold ${textPrimary} mb-6 flex items-center gap-2`}>
            <Lock size={18} className="text-blue-500" /> Change Password
          </h2>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={`w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBg}`}
                placeholder="Enter current password"
              />
            </div>

            <div>
              <label className={`block text-sm font-medium ${textSecondary} mb-2`}>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={`w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBg}`}
                placeholder="Min 6 characters"
              />
            </div>

            <button
              type="submit"
              disabled={passwordLoading || !currentPassword || !newPassword}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-500 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {passwordLoading ? <><Loader2 size={18} className="animate-spin" /> Changing...</> : <><Lock size={18} /> Change Password</>}
            </button>
          </form>
        </div>

        {/* Danger Zone */}
        <div className={`border border-red-500 border-opacity-30 rounded-2xl p-6 ${isDark ? 'bg-red-950 bg-opacity-20' : 'bg-red-50'}`}>
          <h2 className="font-bold text-red-400 mb-2">Danger Zone</h2>
          <p className={`text-sm ${textSecondary} mb-4`}>Deactivating your account will remove access to all meetings and data.</p>
          <button className="text-sm text-red-400 border border-red-400 border-opacity-50 px-4 py-2 rounded-xl hover:bg-red-500 hover:bg-opacity-10 transition">
            Deactivate Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;