//! Spring-damper physics for smooth bar animations.
//! Each bar has a current height and velocity, and moves toward a target
//! with configurable spring stiffness and damping.

/// State for a collection of animated bars.
#[derive(Clone, Debug)]
pub struct PhysicsState {
    /// Current bar heights
    pub heights: Vec<f32>,
    /// Current bar velocities
    pub velocities: Vec<f32>,
    /// Spring stiffness (higher = snappier)
    pub stiffness: f32,
    /// Damping coefficient (higher = less oscillation)
    pub damping: f32,
}

impl PhysicsState {
    /// Create a new physics state for `num_bars` bars.
    /// Stiffness and damping are tuned for 60fps visualisation.
    pub fn new(num_bars: usize) -> Self {
        Self {
            heights: vec![0.0; num_bars],
            velocities: vec![0.0; num_bars],
            stiffness: 180.0,
            damping: 12.0,
        }
    }

    /// Create with custom spring parameters.
    pub fn with_params(num_bars: usize, stiffness: f32, damping: f32) -> Self {
        Self {
            heights: vec![0.0; num_bars],
            velocities: vec![0.0; num_bars],
            stiffness: stiffness.max(0.0),
            damping: damping.max(0.0),
        }
    }

    /// Get the number of bars.
    pub fn len(&self) -> usize {
        self.heights.len()
    }

    /// Check if state has no bars.
    pub fn is_empty(&self) -> bool {
        self.heights.is_empty()
    }

    /// Update physics simulation. Each bar's height springs toward its
    /// corresponding target value.
    ///
    /// # Arguments
    /// * `targets` - Target heights for each bar (clamped to bar count)
    /// * `dt` - Delta time in seconds
    ///
    /// # Returns
    /// Current bar heights after simulation step
    pub fn update(&mut self, targets: &[f32], dt: f32) -> Vec<f32> {
        let dt = dt.clamp(0.0, 0.1); // Cap dt to prevent explosion
        let n = self.heights.len();

        for i in 0..n {
            let target = if i < targets.len() { targets[i] } else { 0.0 };

            // Spring force: F = -k * (x - target)
            let displacement = self.heights[i] - target;
            let spring_force = -self.stiffness * displacement;

            // Damping force: F = -c * v
            let damping_force = -self.damping * self.velocities[i];

            // Acceleration
            let acceleration = spring_force + damping_force;

            // Semi-implicit Euler integration
            self.velocities[i] += acceleration * dt;
            self.heights[i] += self.velocities[i] * dt;

            // Clamp to non-negative
            if self.heights[i] < 0.0 {
                self.heights[i] = 0.0;
                self.velocities[i] = self.velocities[i].max(0.0);
            }
        }

        self.heights.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_state_zeroed() {
        let state = PhysicsState::new(8);
        assert_eq!(state.len(), 8);
        assert!(state.heights.iter().all(|&h| h == 0.0));
        assert!(state.velocities.iter().all(|&v| v == 0.0));
    }

    #[test]
    fn test_empty_state() {
        let state = PhysicsState::new(0);
        assert!(state.is_empty());
        assert_eq!(state.len(), 0);
    }

    #[test]
    fn test_converges_toward_target() {
        let mut state = PhysicsState::new(1);
        let target = [100.0];

        // Run 200 frames at 60fps
        for _ in 0..200 {
            state.update(&target, 1.0 / 60.0);
        }

        // Should be very close to target
        assert!(
            (state.heights[0] - 100.0).abs() < 1.0,
            "Expected ~100, got {}",
            state.heights[0]
        );
    }

    #[test]
    fn test_heights_non_negative() {
        let mut state = PhysicsState::new(4);
        // Set heights high then target zero — should not go below zero
        state.heights = vec![50.0, 100.0, 200.0, 500.0];
        for _ in 0..1000 {
            state.update(&[0.0, 0.0, 0.0, 0.0], 1.0 / 60.0);
        }
        for &h in &state.heights {
            assert!(h >= 0.0, "Height went negative: {h}");
        }
    }

    #[test]
    fn test_dt_clamped() {
        let mut state = PhysicsState::new(2);
        // Huge dt should not cause explosion
        let result = state.update(&[100.0, 200.0], 10.0);
        for &h in &result {
            assert!(h.is_finite(), "Height not finite after large dt");
        }
    }

    #[test]
    fn test_fewer_targets_than_bars() {
        let mut state = PhysicsState::new(4);
        // Only 2 targets — remaining bars should target 0
        for _ in 0..100 {
            state.update(&[50.0, 80.0], 1.0 / 60.0);
        }
        assert!(state.heights[0] > 10.0); // Should approach 50
        assert!(state.heights[2].abs() < 5.0); // Should stay near 0
    }

    #[test]
    fn test_custom_params() {
        let state = PhysicsState::with_params(4, 300.0, 20.0);
        assert_eq!(state.stiffness, 300.0);
        assert_eq!(state.damping, 20.0);
    }
}
