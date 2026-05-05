/**
 * index.ts — Điểm khởi động của ứng dụng Expo
 *
 * Chịu trách nhiệm:
 * - Đăng ký component gốc (App) với Expo runtime
 * - Đảm bảo môi trường được khởi tạo đúng dù chạy trên Expo Go hay native build
 *
 * Được dùng bởi:
 * - Expo runtime tự động gọi khi khởi động app
 *
 * Lưu ý: Không sửa file này — đây là entry point chuẩn của Expo
 */
import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
