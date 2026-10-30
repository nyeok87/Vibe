import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 한 폴더에 lock 파일이 여러 개 있을 때 경고가 뜨지 않도록 루트를 고정
  turbopack: { root: __dirname },
};

export default nextConfig;
