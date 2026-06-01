import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signup } from '../../services/authService';
import useAuthStore from '../../store/authStore';
import { Mail, Lock, User, Eye, EyeOff, Loader2 } from 'lucide-react';

const Signup = () => {
  const navigate = useNavigate();
  const { setTokens, setUser } = useAuthStore();
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await signup(formData);
      setTokens(response.accessToken, response.refreshToken);
      setUser(response.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-900 flex items-center justify-center p-4">

      <div className="absolute top-20 right-20 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
      <div className="absolute bottom-20 left-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>

      <div className="relative bg-white bg-opacity-10 backdrop-blur-lg rounded-3xl shadow-2xl p-8 w-full max-w-md border border-white border-opacity-20">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-3xl">🤖</span>
          </div>
          <h1 className="text-3xl font-bold text-white">IntellMeet</h1>
          <p className="text-blue-200 mt-2">Create your account to get started</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500 bg-opacity-20 border border-red-400 border-opacity-50 text-red-200 p-3 rounded-xl mb-6 text-sm flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-blue-200 mb-2">Full Name</label>
            <div className="relative">
              <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" />
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-white bg-opacity-10 border border-white border-opacity-20 rounded-xl px-4 py-3 pl-10 text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                placeholder="Sundaram Tiwari"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-blue-200 mb-2">Email address</label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" />
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-white bg-opacity-10 border border-white border-opacity-20 rounded-xl px-4 py-3 pl-10 text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                placeholder="you@example.com"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-blue-200 mb-2">Password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full bg-white bg-opacity-10 border border-white border-opacity-20 rounded-xl px-4 py-3 pl-10 pr-10 text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                placeholder="Min 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300 hover:text-white"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2 shadow-lg"
          >
            {loading ? (
              <><Loader2 size={18} className="animate-spin" /> Creating account...</>
            ) : 'Create Account →'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-white bg-opacity-20"></div>
          <span className="text-blue-300 text-sm">or</span>
          <div className="flex-1 h-px bg-white bg-opacity-20"></div>
        </div>

        <p className="text-center text-blue-200 text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-300 font-semibold hover:text-white transition">
            Sign in →
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;