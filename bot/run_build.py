import subprocess
import sys

def main():
    print("Running npm run build inside python subprocess...")
    try:
        # On Windows, we need shell=True to run npm command
        res = subprocess.run("npm run build", shell=True, capture_output=True, text=True)
        print("=== STDOUT ===")
        print(res.stdout)
        print("=== STDERR ===")
        print(res.stderr)
        if res.returncode == 0:
            print("Build succeeded!")
            sys.exit(0)
        else:
            print(f"Build failed with return code {res.returncode}")
            sys.exit(1)
    except Exception as e:
        print(f"Error running subprocess: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
