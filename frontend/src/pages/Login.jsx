import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { getErrorMsg } from '../components/utils';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async ({ email, password }) => {
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-primary-600 text-xl font-black">AI</span>
          </div>
          <h1 className="text-3xl font-black text-white">AIMS</h1>
          <p className="text-primary-200 mt-1 text-sm">Automated Inventory Management System</p>
        </div>

        {/* Card */}
        <div className="card card-body">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 text-center">Sign in to your account</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                className={`input ${errors.email ? 'input-error' : ''}`}
                placeholder="you@aims.local"
                {...register('email', { required: 'Email is required' })}
              />
              {errors.email && <p className="error-msg">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className={`input ${errors.password ? 'input-error' : ''}`}
                placeholder="••••••••"
                {...register('password', { required: 'Password is required' })}
              />
              {errors.password && <p className="error-msg">{errors.password.message}</p>}
            </div>

            <button type="submit" className="btn-primary w-full btn-lg justify-center mt-2" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
            <p className="font-semibold text-gray-700 mb-1">Demo credentials:</p>
            <p>admin@aims.local — Super Admin</p>
            <p>priya@aims.local — Salesperson</p>
            <p className="mt-1">Password: <span className="font-mono font-semibold">Admin@123</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
