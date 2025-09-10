interface UvBuild {
  url: string;
  filename: string;
}

const UV_BUILDS: Record<string, Record<string, UvBuild>> = {
  win32: {
    x64: {
      url: 'https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-pc-windows-msvc.zip',
      filename: 'uv-x86_64-pc-windows-msvc.zip'
    }
  },
  darwin: {
    x64: {
      url: 'https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-apple-darwin.tar.gz',
      filename: 'uv-x86_64-apple-darwin.tar.gz'
    },
    arm64: {
      url: 'https://github.com/astral-sh/uv/releases/latest/download/uv-aarch64-apple-darwin.tar.gz',
      filename: 'uv-aarch64-apple-darwin.tar.gz'
    }
  },
  linux: {
    x64: {
      url: 'https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-unknown-linux-gnu.tar.gz',
      filename: 'uv-x86_64-unknown-linux-gnu.tar.gz'
    }
  }
};