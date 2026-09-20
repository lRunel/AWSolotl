EMCC = ../emsdk/upstream/emscripten/emcc

SRCS = core/kernel.c core/vfs.c core/resume.c \
       core/project_arecanut.c core/project_gem.c \
       core/project_dlframework.c core/project_arshirt.c \
       core/project_runeos.c core/vectors_data.c \
       kernel_wasm.c
INC  = -I include

OUT_DIR = ../wasm
OUT     = $(OUT_DIR)/kernel.js

EMFLAGS = \
	-sEXPORTED_RUNTIME_METHODS=ccall,cwrap,UTF8ToString \
	-sEXPORTED_FUNCTIONS=_wasm_kernel_init,_wasm_syscall,_wasm_get_output \
	-sMODULARIZE=1 \
	-sEXPORT_NAME=KernelModule \
	-sALLOW_MEMORY_GROWTH=1 \
	-sASSERTIONS=1 \
	--no-entry \
	-O2

.PHONY: all clean

all: $(OUT_DIR) $(OUT)

$(OUT_DIR):
	mkdir -p $(OUT_DIR)

$(OUT): $(SRCS)
	$(EMCC) $(SRCS) $(INC) -o $(OUT) $(EMFLAGS)
	@echo "Build complete: $(OUT)"

clean:
	rm -f $(OUT_DIR)/kernel.js $(OUT_DIR)/kernel.wasm
