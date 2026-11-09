import { Navigate } from "react-router-dom";

// Shared route guard, following the ProtectedRoute pattern from the EMS project.
// This frontend currently uses demo login state; Django authentication can replace it later.
function ProtectedRoute({ children, loggedIn }) {
  if (!loggedIn) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default ProtectedRoute;
