import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Results has been merged into Academic Records (/grades).
export default function Results() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/grades', { replace: true }); }, []);
  return null;
}
