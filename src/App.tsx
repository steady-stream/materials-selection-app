import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import CategoryDetail from "./components/CategoryDetail";
import CategoryForm from "./components/CategoryForm";
import Layout from "./components/Layout";
import LineItemForm from "./components/LineItemForm";
import Login from "./components/Login";
import ManufacturerForm from "./components/ManufacturerForm";
import ManufacturerList from "./components/ManufacturerList";
import ProductList from "./components/ProductList";
import ProjectDetail from "./components/ProjectDetail";
import ProjectForm from "./components/ProjectForm";
import ProjectList from "./components/ProjectList";
import ProtectedRoute from "./components/ProtectedRoute";
import ReviewPage from "./components/ReviewPage";
import VendorForm from "./components/VendorForm";
import VendorList from "./components/VendorList";

function App() {
  return (
    <Router>
      <Routes>
        {/* Public — login page renders its own full-page layout */}
        <Route path="/login" element={<Login />} />

        {/* Public — review page is standalone, no auth required, no nav */}
        <Route path="/review/:token" element={<ReviewPage />} />

        {/* Protected — pathless guard renders Outlet when authenticated */}
        <Route element={<ProtectedRoute />}>
          {/* Pathless layout — renders nav + Outlet */}
          <Route element={<Layout />}>
            <Route index element={<ProjectList />} />
            <Route path="/projects/new" element={<ProjectForm />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/projects/:id/edit" element={<ProjectForm />} />
            <Route
              path="/projects/:projectId/categories/new"
              element={<CategoryForm />}
            />
            <Route path="/categories/:id" element={<CategoryDetail />} />
            <Route
              path="/categories/:categoryId/edit"
              element={<CategoryForm />}
            />
            <Route
              path="/categories/:categoryId/lineitems/new"
              element={<LineItemForm />}
            />
            <Route
              path="/lineitems/:lineItemId/edit"
              element={<LineItemForm />}
            />
            <Route path="/vendors" element={<VendorList />} />
            <Route path="/vendors/new" element={<VendorForm />} />
            <Route path="/vendors/:vendorId/edit" element={<VendorForm />} />
            <Route path="/manufacturers" element={<ManufacturerList />} />
            <Route path="/manufacturers/new" element={<ManufacturerForm />} />
            <Route
              path="/manufacturers/:manufacturerId/edit"
              element={<ManufacturerForm />}
            />
            <Route path="/products" element={<ProductList />} />
          </Route>
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
