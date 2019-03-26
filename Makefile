.PHONY: pip_compile

PIP_DEPENDENCY_DIR=dependencies/pip
PIP_DEPENDENCY_SOURCES=$(wildcard $(PIP_DEPENDENCY_DIR)/*.in)
PIP_DEPENDENCY_TARGETS=$(PIP_DEPENDENCY_SOURCES:.in=.txt)

pip_compile: $(PIP_DEPENDENCY_TARGETS)

# All `pip` dependency files depend on their corresponding `.in` file and the base `requirements.in`.
$(PIP_DEPENDENCY_DIR)/%.txt: $(PIP_DEPENDENCY_DIR)/%.in $(PIP_DEPENDENCY_DIR)/requirements.in
	CUSTOM_COMPILE_COMMAND='make pip_compile' pip-compile --output-file=$@ ${ARGS} $<

