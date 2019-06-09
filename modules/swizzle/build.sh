#!/bin/sh
export MACOSX_DEPLOYMENT_TARGET=10.10
g++ -dynamiclib -o ../swizzle.dylib swizzle.m -O2 -framework Foundation -framework AppKit