use stellar_viz::physics::PhysicsState;

#[test]
fn test_physics_multi_bar_convergence() {
    let mut state = PhysicsState::new(4);
    let targets = [100.0, 200.0, 150.0, 50.0];

    for _ in 0..300 {
        state.update(&targets, 1.0 / 60.0);
    }

    for (i, &target) in targets.iter().enumerate() {
        assert!(
            (state.heights[i] - target).abs() < 2.0,
            "Bar {i}: expected ~{target}, got {}",
            state.heights[i]
        );
    }
}

#[test]
fn test_physics_rapid_target_change() {
    let mut state = PhysicsState::new(2);

    // Drive to 100
    for _ in 0..100 {
        state.update(&[100.0, 100.0], 1.0 / 60.0);
    }

    // Suddenly drop to 0
    for _ in 0..200 {
        state.update(&[0.0, 0.0], 1.0 / 60.0);
    }

    for &h in &state.heights {
        assert!(h < 5.0, "Should converge back near 0, got {h}");
    }
}

#[test]
fn test_physics_custom_stiffness() {
    // Higher stiffness with proportional damping converges faster
    let mut stiff = PhysicsState::with_params(1, 300.0, 24.0);
    let mut soft = PhysicsState::with_params(1, 30.0, 6.0);

    // Run enough frames for the stiff spring to settle
    for _ in 0..120 {
        stiff.update(&[100.0], 1.0 / 60.0);
        soft.update(&[100.0], 1.0 / 60.0);
    }

    // Stiffer spring should be closer to target (lower error)
    let stiff_error = (stiff.heights[0] - 100.0).abs();
    let soft_error = (soft.heights[0] - 100.0).abs();
    assert!(
        stiff_error < soft_error,
        "Stiffer spring error ({stiff_error}) should be less than softer ({soft_error})"
    );
}
