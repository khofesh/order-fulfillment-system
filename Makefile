# Local workflow against the AWS Emulator
EMU := ./scripts/with-emulator.sh
TF  := terraform -chdir=infra

EMU_VARS := -var environment=local -var poll_interval_seconds=2 -var max_polls=3

.PHONY: bundle emulator-up emulator-down emulator-init emulator-plan emulator-apply emulator-reset emulator-destroy emulator-outputs emulator-smoke

bundle:
	cd backend && npm run bundle

# Start the emulator in Docker (builds the image on first run). Stopping it drops all its state.
emulator-up:
	./scripts/emulator-up.sh

emulator-down:
	docker stop aws-emulator

emulator-init:
	$(TF) init -input=false
	$(TF) workspace select -or-create emulator

emulator-plan: bundle emulator-init
	$(EMU) $(TF) plan $(EMU_VARS)

emulator-apply: bundle emulator-init
	$(EMU) $(TF) apply -auto-approve $(EMU_VARS)

# The emulator drops all state on restart; after restarting it, clear the stale
# workspace state with `make emulator-reset` before applying again.
emulator-reset:
	$(TF) workspace select -or-create emulator
	rm -f infra/terraform.tfstate.d/emulator/terraform.tfstate*

emulator-destroy:
	$(EMU) $(TF) destroy -auto-approve $(EMU_VARS)

emulator-outputs:
	$(TF) output

emulator-smoke:
	$(EMU) ./scripts/smoke-emulator.sh
