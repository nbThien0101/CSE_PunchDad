export default async function handler(req, res) {
  // Lấy giờ hiện tại (UTC)
  const now = new Date();
  const currentHourUTC = now.getUTCHours();
  
  // 7h sáng VN = 0h UTC
  // 1h sáng hôm sau VN = 18h UTC
  // Nghĩa là khung giờ thức: từ 0 đến 17 UTC
  const isAwakeTime = currentHourUTC >= 0 && currentHourUTC <= 17;

  if (isAwakeTime) {
    try {
      // Thay thế URL render của bạn bên dưới
      const renderApiUrl = process.env.RENDER_API_URL || 'https://cse-punchdad-api.onrender.com';
      
      // Ping Render server
      const response = await fetch(`${renderApiUrl}/api/health`);
      
      if (response.ok) {
        return res.status(200).json({ 
          status: 'pinged', 
          message: 'Render server was successfully pinged to keep alive.' 
        });
      } else {
        return res.status(500).json({ 
          status: 'error', 
          message: 'Failed to ping Render server.' 
        });
      }
    } catch (error) {
      return res.status(500).json({ 
        status: 'error', 
        message: 'Network error when pinging Render.' 
      });
    }
  } else {
    // Ngoài giờ thức, không làm gì cả để Render ngủ
    return res.status(200).json({ 
      status: 'sleep', 
      message: 'Outside of awake hours (1AM - 7AM VN). Let Render sleep.' 
    });
  }
}
