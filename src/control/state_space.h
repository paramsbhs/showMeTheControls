#pragma once

#include <Eigen/Dense>

struct StateSpace {
    Eigen::MatrixXd A;
    Eigen::MatrixXd B;
    Eigen::MatrixXd C;
    Eigen::MatrixXd D;
};

StateSpace CreateSecondOrderExampleStateSpace(double m = 1.0, double k = 1.0, double b = 0.1, double dt = 0.001);

Eigen::MatrixXd ControllabilityMatrix(const StateSpace& ss);
Eigen::MatrixXd ObservabilityMatrix(const StateSpace& ss);
int MatrixRank(const Eigen::MatrixXd& matrix);
bool IsControllable(const StateSpace& ss);
bool IsObservable(const StateSpace& ss);
