---
description: End-to-end guide for adding a new feature across frontend and backend
---

# Add Fullstack Feature Workflow

Use this workflow when you need to add a new visible feature (e.g., "Add a settings page for Model Configuration").

## Phase 1: Frontend Design (Mocking)
1. **Create the UI Component**: Build the UI in `frontend/src/components` or `frontend/src/pages`.
2. **Mock the Data**: Do NOT connect to the API yet. Create a fake object in the component.
   ```javascript
   const [data, setData] = useState({ id: 1, name: "Mock Model" });
   ```
3. **Review**: Ensure it looks good (TailwindCSS) and behaves correctly.

## Phase 2: Backend Implementation
1. **Define Schema**: Create `backend/app/schemas/your_feature.py`. Define Input/Output types.
2. **Database Changes**:
   - Update `models/`.
   - Run `database_migration` user flow.
3. **Implement API**:
   - Create `backend/app/routers/your_feature.py`.
   - Implement GET/POST/PUT/DELETE.
4. **Test API**: Use Swagger UI (http://localhost:8000/docs) to verify it works.

## Phase 3: Integration
1. **Update Frontend API Client**:
   - Add function to `frontend/src/api/` (if separated) or use `axios` directly in component.
2. **Replace Mock Data**:
   ```javascript
   useEffect(() => {
     api.getYourFeature().then(setData);
   }, []);
   ```
3. **Handle Loading/States**: Add `isLoading` and error handling.

## Phase 4: Verification
- [ ] Backend Tests: Run `pytest backend/tests`
- [ ] Manual Check: Click through the flow in the browser.
