import { getState, setState } from './game-state.js';
import { updateGameUI, showPathCost, drawMap } from './ui.js';
import { calculatePath, calculateMovementCost } from './pathfinding.js';
import { isTileBlocked } from './terrain.js';
import { pushStateToSupabase } from '../lib/supabase.js';

function performAction(unitId, targetX, targetY) {
  const state = getState();
  const unit = state.units.find(u => u.id === unitId && u.owner === state.playerId);
  if (!unit || state.currentTurn !== state.playerId || unit.ap < 1) return;

  const dx = targetX - unit.x;
  const dy = targetY - unit.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance <= 3 && !isTileBlocked(targetX, targetY)) {
    unit.ap -= 1;
    const targetUnit = state.units.find(u => u.x === targetX && u.y === targetY);
    if (targetUnit) {
      targetUnit.hp -= 1;
      if (targetUnit.hp <= 0) {
        state.units = state.units.filter(u => u.id !== targetUnit.id);
      }
    }
    setState(state);
    pushStateToSupabase();
    updateGameUI();
  }
}

function endTurn() {
  const state = getState();
  state.currentTurn = state.currentTurn === 'player1' ? 'player2' : 'player1';
  state.units.forEach(unit => {
    if (unit.owner === state.currentTurn) {
      unit.mp = 10;
      unit.ap = 1;
    }
  });
  setState(state);
  pushStateToSupabase();
  updateGameUI();
}

function animateMovement(unit, path, callback) {
  if (path.length === 0) {
    callback();
    return;
  }
  const [nextStep, ...rest] = path;
  unit.x = nextStep.x;
  unit.y = nextStep.y;
  setState(getState());
  updateGameUI();
  setTimeout(() => animateMovement(unit, rest, callback), 100);
}

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const col = Math.floor(x / 32);
    const row = Math.floor(y / 28);

    const state = getState();
    if (!state.map?.[row]?.[col]) return;

    const selectedUnit = state.units.find(u => u.id === state.selectedUnitId);

    if (selectedUnit && state.currentTurn === state.playerId) {
      const path = calculatePath(selectedUnit.x, selectedUnit.y, col, row, state.map);
      if (!path) return;
      const cost = calculateMovementCost(path, state.map);

      if (path.length > 0 && selectedUnit.mp >= cost) {
        selectedUnit.mp -= cost;
        animateMovement(selectedUnit, path, async () => {
          await pushStateToSupabase();
          updateGameUI();
        });
      }
    } else {
      const clickedUnit = state.units.find(u => u.x === col && u.y === row && u.owner === state.playerId);
      if (clickedUnit) {
        setState({ ...state, selectedUnitId: clickedUnit.id });
        updateGameUI();
      }
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const col = Math.floor(x / 32);
    const row = Math.floor(y / 28);

    const state = getState();
    const unit = state.units.find(u => u.id === state.selectedUnitId);
    if (!unit || state.currentTurn !== state.playerId) return;

    const path = calculatePath(unit.x, unit.y, col, row, state.map);
    if (path && path.length > 0) {
      const cost = calculateMovementCost(path, state.map);
      showPathCost(path, cost);
    } else {
      drawMap();
      drawDebugInfo(col, row);
    }
  });

  document.getElementById('selectUnitBtn')?.addEventListener('click', () => {
    const state = getState();
    if (state.currentTurn === state.playerId) {
      const unit = state.units.find(u => u.owner === state.playerId);
      if (unit) {
        setState({ ...state, selectedUnitId: unit.id });
        updateGameUI();
      }
    } else {
      alert('It is not your turn.');
    }
  });
});

export { performAction, endTurn };


