import React, { useState } from 'react';
import { CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';

export const RegisterPage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    location: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const requirements = {
    length: formData.password.length >= 8,
    uppercase: /[A-Z]/.test(formData.password),
    number: /[0-9]/.test(formData.password),
    special: /[^A-Za-z0-9]/.test(formData.password),
  };
  
  const allRequirementsMet = Object.values(requirements).every(Boolean);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegistrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allRequirementsMet) return;
    
    setIsSubmitting(true);
    setErrorMsg('');
    
    try {
      // Fallback to localhost if env var is missing
      const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
      
      const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "Registration failed";
        try {
          const errJson = JSON.parse(errorText);
          errorMessage = errJson.detail || errorMessage;
        } catch (parseErr) {
          errorMessage = `Server Error (${response.status}): Check backend terminal.`;
        }
        throw new Error(errorMessage);
      }
      
      setShowOtp(true);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
      const response = await fetch(`${API_URL}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, otp_code: otp })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "Invalid OTP code";
        try {
          const errJson = JSON.parse(errorText);
          errorMessage = errJson.detail || errorMessage;
        } catch {
          errorMessage = `Server Error (${response.status})`;
        }
        throw new Error(errorMessage);
      }
      
      alert("Registration Complete! Redirecting to login...");
      window.location.href = '/login'; 
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-gray-100 relative">
        
        <div className="absolute top-6 left-6">
          <Link to="/login" className="text-sm font-medium text-gray-500 hover:text-teal-600 transition-colors flex items-center">
            ← Back
          </Link>
        </div>
        
        {errorMsg && (
          <div className="bg-red-50 p-4 rounded-md text-sm text-red-700 mt-8">
            {errorMsg}
          </div>
        )}
        
        {!showOtp ? (
          <div className="pt-4">
            <div>
              <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">
                Create your account
              </h2>
              <p className="mt-2 text-center text-sm text-gray-600">
                Start tracking your finances today.
              </p>
            </div>
            
            <form className="mt-8 space-y-6" onSubmit={handleRegistrationSubmit}>
              <div className="space-y-4">
                <div>
                  <input id="name" name="name" type="text" required
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                    placeholder="Full Name"
                    value={formData.name} onChange={handleInputChange} />
                </div>
                <div>
                  <input id="email" name="email" type="email" required
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                    placeholder="Email address"
                    value={formData.email} onChange={handleInputChange} />
                </div>
                <div>
                  <input id="location" name="location" type="text"
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                    placeholder="Location (Optional)"
                    value={formData.location} onChange={handleInputChange} />
                </div>
                <div className="relative">
                  <input id="password" name="password" type={showPassword ? "text" : "password"} required
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm pr-10"
                    placeholder="Password"
                    value={formData.password} onChange={handleInputChange} />
                  <button type="button" 
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                  </button>
                </div>
              </div>

              {formData.password.length > 0 && (
                <div className="bg-gray-50 p-4 rounded-md text-sm">
                  <p className="font-semibold text-gray-700 mb-2">Password must contain:</p>
                  <ul className="space-y-1">
                    <RequirementItem met={requirements.length} text="At least 8 characters" />
                    <RequirementItem met={requirements.uppercase} text="One uppercase letter" />
                    <RequirementItem met={requirements.number} text="One number" />
                    <RequirementItem met={requirements.special} text="One special character" />
                  </ul>
                </div>
              )}

              <button type="submit" disabled={!allRequirementsMet || isSubmitting}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors">
                {isSubmitting ? 'Processing...' : 'Create Account'}
              </button>
            </form>
          </div>
        ) : (
          <div className="text-center pt-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Verify Your Email</h2>
            <p className="text-gray-600 mb-8">
              We sent a 6-digit code to <span className="font-semibold">{formData.email}</span>.
            </p>
            <form onSubmit={handleOtpSubmit} className="space-y-6">
              <input type="text" maxLength={6} required
                className="text-center tracking-widest text-2xl appearance-none rounded-md relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-teal-500 focus:border-teal-500"
                placeholder="000000"
                value={otp} onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))} />
              
              <button type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 transition-colors">
                Verify & Login
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

const RequirementItem = ({ met, text }: { met: boolean; text: string }) => (
  <li className="flex items-center space-x-2">
    {met ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
    <span className={met ? "text-green-700" : "text-gray-500"}>{text}</span>
  </li>
);
